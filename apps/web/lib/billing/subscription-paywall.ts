import "server-only";

import { redirect } from "next/navigation";
import type { UserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { loadBillingEntitlementForAuthUser } from "@/lib/billing/ensure-billing-entitlement";
import { ACCESS_PLAN_PATH, isPaywallEnforced } from "@/lib/billing/paywall-config";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export { isPaywallEnforced };

/**
 * Server-side gate per il layout (shell)/.
 * Solo lettura DB — niente Stripe qui (evita crash/timeout al login).
 */
export async function gateAuthenticatedShellAccessOrRedirect(): Promise<UserAccessEntitlement | null> {
  const cookieClient = createSupabaseCookieClient();
  if (!cookieClient) return null;

  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  if (!user) return null;

  const entitlement = await loadBillingEntitlementForAuthUser(user.id);

  if (!isPaywallEnforced()) {
    return entitlement;
  }

  if (entitlement.hasAthleteAccess || entitlement.hasOperatorAccess) {
    return entitlement;
  }

  redirect(`${ACCESS_PLAN_PATH}?required=subscription`);
}
