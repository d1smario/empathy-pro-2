import "server-only";

import { redirect } from "next/navigation";
import type { UserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { ensureBillingEntitlementForAuthUser } from "@/lib/billing/ensure-billing-entitlement";
import { ACCESS_PLAN_PATH, isPaywallEnforced } from "@/lib/billing/paywall-config";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export { isPaywallEnforced };

/**
 * Server-side gate per il layout (shell)/.
 * Loggato senza entitlement → sync Stripe (se pagato) → altrimenti `/access/plan`.
 */
export async function gateAuthenticatedShellAccessOrRedirect(): Promise<UserAccessEntitlement | null> {
  const cookieClient = createSupabaseCookieClient();
  if (!cookieClient) return null;

  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  if (!user) return null;

  if (!isPaywallEnforced()) {
    return ensureBillingEntitlementForAuthUser(user.id, user.email ?? null, {
      repairFromStripe: false,
    });
  }

  const entitlement = await ensureBillingEntitlementForAuthUser(user.id, user.email ?? null, {
    repairFromStripe: true,
  });

  if (entitlement.hasAthleteAccess || entitlement.hasOperatorAccess) {
    return entitlement;
  }

  redirect(`${ACCESS_PLAN_PATH}?required=subscription`);
}
