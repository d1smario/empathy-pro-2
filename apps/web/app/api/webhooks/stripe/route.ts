import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { readStripeSecretKey, readStripeWebhookSecret } from "@/lib/billing/stripe-secret";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BillingPlanMetadata = {
  userId: string | null;
  basePlanId: string | null;
  coachAddOnId: string | null;
};

function stringFromMetadata(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function readBillingMetadata(metadata: Stripe.Metadata | null | undefined): BillingPlanMetadata {
  return {
    userId: stringFromMetadata(metadata?.user_id),
    basePlanId: stringFromMetadata(metadata?.base_plan_id),
    coachAddOnId: stringFromMetadata(metadata?.coach_addon_id),
  };
}

function stripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (typeof customer === "string") return customer;
  if (customer && "id" in customer) return customer.id;
  return null;
}

function unixToIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

async function webhookEventAlreadyProcessed(eventId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.from("stripe_webhook_events").select("id").eq("id", eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

async function markWebhookEventProcessed(eventId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.from("stripe_webhook_events").insert({ id: eventId });
  if (error && error.code !== "23505") throw new Error(error.message);
}

async function upsertBillingCustomer(input: { userId: string; stripeCustomerId: string; email?: string | null }) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata per persistenza billing.");
  const { error } = await admin.from("billing_customers").upsert(
    {
      user_id: input.userId,
      stripe_customer_id: input.stripeCustomerId,
      email: input.email ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

async function upsertBillingSubscription(subscription: Stripe.Subscription) {
  const metadata = readBillingMetadata(subscription.metadata);
  if (!metadata.userId) return;
  const customerId = stripeCustomerId(subscription.customer);
  if (!customerId) return;
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata per persistenza billing.");
  const { error } = await admin.from("billing_subscriptions").upsert(
    {
      user_id: metadata.userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: subscription.status,
      current_period_end: unixToIso(subscription.current_period_end),
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
      base_plan_id: metadata.basePlanId ?? "unknown",
      coach_addon_id: metadata.coachAddOnId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) throw new Error(error.message);
}

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  const metadata = readBillingMetadata(session.metadata);
  if (!metadata.userId) return;
  const customerId = stripeCustomerId(session.customer);
  if (!customerId) return;
  await upsertBillingCustomer({
    userId: metadata.userId,
    stripeCustomerId: customerId,
    email: session.customer_details?.email ?? session.customer_email ?? null,
  });
  if (typeof session.subscription === "string") {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await upsertBillingSubscription(subscription);
  }
}

async function handleStripeEvent(stripe: Stripe, event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
    return;
  }
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await upsertBillingSubscription(event.data.object as Stripe.Subscription);
  }
}

/** Evita 404 “muto” se qualcuno apre l’URL nel browser; Stripe usa solo POST. */
export async function GET() {
  return NextResponse.json(
    { ok: false as const, error: "Metodo non supportato. Stripe invia POST con body raw e header stripe-signature." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

/**
 * Webhook Stripe: verifica firma, persiste eventi + customer/subscription quando il checkout contiene `user_id`.
 * Endpoint Dashboard: `https://<host>/api/webhooks/stripe`
 */
export async function POST(req: NextRequest) {
  const webhookSecret = readStripeWebhookSecret();
  const secretKey = readStripeSecretKey();
  if (!webhookSecret || !secretKey) {
    return NextResponse.json({ error: "Stripe webhook non configurato (env mancanti)." }, { status: 503 });
  }

  const stripe = new Stripe(secretKey, { typescript: true });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Header stripe-signature mancante." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verifica firma fallita.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (await webhookEventAlreadyProcessed(event.id)) {
    return NextResponse.json({ received: true as const, duplicate: true as const });
  }

  await handleStripeEvent(stripe, event);
  await markWebhookEventProcessed(event.id);

  console.info("[stripe webhook pro2]", event.type, event.id);

  return NextResponse.json({ received: true as const });
}
