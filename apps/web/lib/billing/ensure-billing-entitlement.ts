import "server-only";

import { createStripeServerClient } from "@empathy/integrations-stripe";
import { unstable_cache } from "next/cache";
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
  /** Se true, interroga Stripe quando manca accesso (default). */
  repairFromStripe?: boolean;
};

const loadUserAccessEntitlementForAuthUserCached = unstable_cache(
  async (userId: string) => {
    const admin = createSupabaseAdminClient();
    const cookieClient = createSupabaseCookieClient();
    const db = admin ?? cookieClient;
    if (!db) {
      return {
        hasOperatorAccess: false,
        hasAthleteAccess: false,
        source: "none",
        validUntil: null,
        label: "DB non configurato",
      } satisfies UserAccessEntitlement;
    }
    return loadUserAccessEntitlement(db, userId);
  },
  ["billing", "user-access-entitlement-v2"],
  { revalidate: 30 },
);

/**
 * Carica entitlement e, se manca accesso atleta, sync immediato da Stripe
 * (session checkout + riconciliazione customer) — non attendere solo il webhook.
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

  if (options.repairFromStripe === false) {
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

/** Helper server: cookie client + admin per gate e pagine. */
export async function ensureBillingEntitlementForAuthUser(
  userId: string,
  email: string | null,
  options?: EnsureBillingEntitlementOptions,
): Promise<UserAccessEntitlement> {
  const admin = createSupabaseAdminClient();
  const cookieClient = createSupabaseCookieClient();
  const db = admin ?? cookieClient;
  if (!db) {
    return {
      hasOperatorAccess: false,
      hasAthleteAccess: false,
      source: "none",
      validUntil: null,
      label: "DB non configurato",
    };
  }
  const baseEntitlement = await loadUserAccessEntitlementForAuthUserCached(userId);
  if (baseEntitlement.hasAthleteAccess || baseEntitlement.hasOperatorAccess) {
    return baseEntitlement;
  }

  if (options?.repairFromStripe === false) {
    return baseEntitlement;
  }

  return ensureBillingEntitlementForUser(db, userId, email, options);
}
