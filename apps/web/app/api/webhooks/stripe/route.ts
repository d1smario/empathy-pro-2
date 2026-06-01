import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ensureSubscriptionWelcomeNotice } from "@/lib/billing/grant-user-notice";
import {
  persistCompletedCheckoutSession,
  upsertBillingSubscription,
} from "@/lib/billing/stripe-billing-persist";
import { readStripeSecretKey, readStripeWebhookSecret } from "@/lib/billing/stripe-secret";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function handleCheckoutCompleted(stripe: Stripe, session: Stripe.Checkout.Session) {
  const metadataUserId =
    typeof session.metadata?.user_id === "string" && session.metadata.user_id.trim() !== ""
      ? session.metadata.user_id.trim()
      : null;
  if (!metadataUserId) return;

  const result = await persistCompletedCheckoutSession(
    stripe,
    session,
    metadataUserId,
    session.customer_details?.email ?? session.customer_email ?? null,
  );
  if (!result.synced) {
    console.warn("[stripe webhook pro2] checkout.session.completed persist skipped", result.reason, session.id);
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
    const subscription = event.data.object as Stripe.Subscription;
    const userId = await upsertBillingSubscription(subscription);
    if (userId && (subscription.status === "trialing" || subscription.status === "active")) {
      const admin = createSupabaseAdminClient();
      if (admin) await ensureSubscriptionWelcomeNotice(admin, userId);
    }
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
