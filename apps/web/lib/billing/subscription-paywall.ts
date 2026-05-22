import "server-only";

import { redirect } from "next/navigation";
import { loadUserAccessEntitlement, type UserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { ACCESS_PLAN_PATH, isPaywallEnforced } from "@/lib/billing/paywall-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export { isPaywallEnforced };

/**
 * Server-side gate per il layout (shell)/.
 * Loggato senza entitlement → `/access/plan` (checkout + trial).
 */
export async function gateAuthenticatedShellAccessOrRedirect(): Promise<UserAccessEntitlement | null> {
  const cookieClient = createSupabaseCookieClient();
  if (!cookieClient) return null;

  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  if (!user) return null;

  const adminClient = createSupabaseAdminClient();
  const db = adminClient ?? cookieClient;

  const entitlement = await loadUserAccessEntitlement(db, user.id);

  if (!isPaywallEnforced()) {
    return entitlement;
  }

  if (entitlement.hasAthleteAccess || entitlement.hasOperatorAccess) {
    return entitlement;
  }

  redirect(`${ACCESS_PLAN_PATH}?required=subscription`);
}
