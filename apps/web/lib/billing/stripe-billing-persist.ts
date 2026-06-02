import "server-only";

import type Stripe from "stripe";
import { ensureSubscriptionWelcomeNotice } from "@/lib/billing/grant-user-notice";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BillingPlanMetadata = {
  userId: string | null;
  basePlanId: string | null;
  coachAddOnId: string | null;
};

function stringFromMetadata(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export function readBillingMetadata(metadata: Stripe.Metadata | null | undefined): BillingPlanMetadata {
  return {
    userId: stringFromMetadata(metadata?.user_id),
    basePlanId: stringFromMetadata(metadata?.base_plan_id),
    coachAddOnId: stringFromMetadata(metadata?.coach_addon_id),
  };
}

export function stripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (typeof customer === "string") return customer;
  if (customer && "id" in customer) return customer.id;
  return null;
}

function unixToIso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}

async function resolveUserIdByStripeCustomer(stripeCustomerIdValue: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerIdValue)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const uid = (data as { user_id?: string } | null)?.user_id;
  return typeof uid === "string" && uid.trim() !== "" ? uid.trim() : null;
}

export async function upsertBillingCustomer(input: {
  userId: string;
  stripeCustomerId: string;
  email?: string | null;
}): Promise<void> {
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

export async function upsertBillingSubscription(
  subscription: Stripe.Subscription,
  userIdOverride?: string | null,
): Promise<string | null> {
  const metadata = readBillingMetadata(subscription.metadata);
  const customerId = stripeCustomerId(subscription.customer);
  if (!customerId) return null;

  let userId = userIdOverride ?? metadata.userId;
  if (!userId) {
    userId = await resolveUserIdByStripeCustomer(customerId);
  }
  if (!userId) return null;

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata per persistenza billing.");
  const { error } = await admin.from("billing_subscriptions").upsert(
    {
      user_id: userId,
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
  return userId;
}

function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function checkoutSessionOwnedByUser(
  session: Stripe.Checkout.Session,
  authUserId: string,
  authEmail: string | null,
): boolean {
  const metaUserId = readBillingMetadata(session.metadata).userId;
  if (metaUserId && metaUserId === authUserId) return true;
  const sessionEmail = session.customer_details?.email ?? session.customer_email ?? null;
  if (emailsMatch(sessionEmail, authEmail)) return true;
  return false;
}

/**
 * Persiste customer + subscription subito al ritorno da Checkout (non attendere solo il webhook).
 */
export async function persistCompletedCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  authUserId: string,
  authEmail: string | null,
): Promise<{ synced: boolean; reason?: string }> {
  if (session.status !== "complete") {
    return { synced: false, reason: "checkout_not_complete" };
  }
  if (!checkoutSessionOwnedByUser(session, authUserId, authEmail)) {
    return { synced: false, reason: "checkout_session_mismatch" };
  }

  const customerId = stripeCustomerId(session.customer);
  if (!customerId) {
    return { synced: false, reason: "missing_stripe_customer" };
  }

  await upsertBillingCustomer({
    userId: authUserId,
    stripeCustomerId: customerId,
    email: session.customer_details?.email ?? session.customer_email ?? authEmail,
  });

  const subscriptionRef = session.subscription;
  let subscription: Stripe.Subscription | null = null;
  if (typeof subscriptionRef === "string") {
    subscription = await stripe.subscriptions.retrieve(subscriptionRef);
  } else if (subscriptionRef && typeof subscriptionRef === "object" && "id" in subscriptionRef) {
    subscription = subscriptionRef as Stripe.Subscription;
  }

  if (!subscription) {
    return { synced: false, reason: "missing_subscription" };
  }

  const persistedUserId = await upsertBillingSubscription(subscription, authUserId);
  if (!persistedUserId) {
    return { synced: false, reason: "subscription_not_persisted" };
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    await ensureSubscriptionWelcomeNotice(admin, authUserId);
  }

  return { synced: true };
}

export async function syncCheckoutSessionById(
  stripe: Stripe,
  sessionId: string,
  authUserId: string,
  authEmail: string | null,
): Promise<{ synced: boolean; reason?: string }> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  return persistCompletedCheckoutSession(stripe, session, authUserId, authEmail);
}

/** Ripara entitlement mancante: utente ha pagato su Stripe ma il webhook non ha scritto su DB. */
export async function reconcileStripeSubscriptionsForUser(
  stripe: Stripe,
  authUserId: string,
  authEmail: string | null,
): Promise<{ synced: boolean; reason?: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { synced: false, reason: "admin_unconfigured" };

  const { data: customerRow } = await admin
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", authUserId)
    .maybeSingle();
  let customerId = (customerRow as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null;

  if (!customerId && authEmail) {
    const listed = await stripe.customers.list({ email: authEmail.trim().toLowerCase(), limit: 5 });
    const match = listed.data[0];
    if (match?.id) {
      customerId = match.id;
      await upsertBillingCustomer({
        userId: authUserId,
        stripeCustomerId: customerId,
        email: authEmail,
      });
    }
  }

  if (!customerId) {
    return { synced: false, reason: "no_stripe_customer" };
  }

  const completedSessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 10 });
  for (const session of completedSessions.data) {
    if (session.status !== "complete" || session.mode !== "subscription") continue;
    try {
      await persistCompletedCheckoutSession(stripe, session, authUserId, authEmail);
    } catch {
      /* session singola non blocca riconciliazione */
    }
  }

  for (const status of ["active", "trialing"] as const) {
    const subs = await stripe.subscriptions.list({ customer: customerId, status, limit: 10 });
    for (const sub of subs.data) {
      try {
        await upsertBillingSubscription(sub, authUserId);
      } catch {
        /* skip */
      }
    }
  }

  const { data: rows } = await admin
    .from("billing_subscriptions")
    .select("status")
    .eq("user_id", authUserId)
    .in("status", ["active", "trialing"])
    .limit(1);
  if (Array.isArray(rows) && rows.length > 0) {
    await ensureSubscriptionWelcomeNotice(admin, authUserId);
    return { synced: true };
  }
  return { synced: false, reason: "no_active_subscription" };
}
