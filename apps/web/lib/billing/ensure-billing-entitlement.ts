import "server-only";

import { createStripeServerClient } from "@empathy/integrations-stripe";
import {
  loadUserAccessEntitlement,
  type UserAccessEntitlement,
} from "@/lib/billing/access-entitlement";
import {
  reconcileStripeSubscriptionsForUser,
  syncCheckoutSessionById,
} from "@/lib/billing/stripe-billing-persist";
import { readStripeSecretKey } from "@/lib/billing/stripe-secret";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EnsureBillingEntitlementOptions = {
  /** Checkout Stripe appena completato (`cs_...`). */
  checkoutSessionId?: string | null;
  /** Se true, interroga Stripe quando manca accesso. Mai nel layout shell. */
  repairFromStripe?: boolean;
};

function noAccessEntitlement(label: string): UserAccessEntitlement {
  return {
    hasOperatorAccess: false,
    hasAthleteAccess: false,
    source: "none",
    validUntil: null,
    label,
  };
}

function billingDb(): SupabaseClient | null {
  return createSupabaseAdminClient() ?? createSupabaseCookieClient();
}

/**
 * Carica entitlement da DB; opzionalmente sync Stripe (solo post-checkout / API repair).
 */
export async function ensureBillingEntitlementForUser(
  db: SupabaseClient,
  userId: string,
  email: string | null,
  options: EnsureBillingEntitlementOptions = {},
): Promise<UserAccessEntitlement> {
  let entitlement = await loadUserAccessEntitlement(db, userId);
  if (entitlement.hasAthleteAccess || entitlement.hasOperatorAccess) {
    return entitlement;
  }

  if (options.repairFromStripe !== true) {
    return entitlement;
  }

  const stripeKey = readStripeSecretKey();
  if (!stripeKey) {
    return entitlement;
  }

  const checkoutSessionId = options.checkoutSessionId?.trim();
  const stripe = createStripeServerClient(stripeKey);

  try {
    if (checkoutSessionId?.startsWith("cs_")) {
      await syncCheckoutSessionById(stripe, checkoutSessionId, userId, email);
      entitlement = await loadUserAccessEntitlement(db, userId);
      if (entitlement.hasAthleteAccess) {
        return entitlement;
      }
    }

    await reconcileStripeSubscriptionsForUser(stripe, userId, email);
    entitlement = await loadUserAccessEntitlement(db, userId);
  } catch (err) {
    console.warn(
      "[billing/ensure-entitlement]",
      userId,
      err instanceof Error ? err.message : err,
    );
  }

  return entitlement;
}

/** Helper server per gate, pagine checkout e API entitlement. */
export async function ensureBillingEntitlementForAuthUser(
  userId: string,
  email: string | null,
  options?: EnsureBillingEntitlementOptions,
): Promise<UserAccessEntitlement> {
  const db = billingDb();
  if (!db) {
    return noAccessEntitlement("DB non configurato");
  }
  return ensureBillingEntitlementForUser(db, userId, email, options);
}

/** Lettura DB-only — sicura nel layout shell (niente Stripe, niente cache). */
export async function loadBillingEntitlementForAuthUser(userId: string): Promise<UserAccessEntitlement> {
  const db = billingDb();
  if (!db) {
    return noAccessEntitlement("DB non configurato");
  }
  return loadUserAccessEntitlement(db, userId);
}
