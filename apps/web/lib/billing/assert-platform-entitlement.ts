import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { TrainingRouteAuthError } from "@/lib/auth/training-route-auth";
import { loadUserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { isPaywallEnforced } from "@/lib/billing/paywall-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Blocco API modulo quando paywall attivo: serve abbonamento/grant atleta o accesso coach operativo.
 */
export async function assertPlatformEntitlementForApi(userId: string, rlsClient: SupabaseClient): Promise<void> {
  if (!isPaywallEnforced()) return;
  const db = createSupabaseAdminClient() ?? rlsClient;
  const ent = await loadUserAccessEntitlement(db, userId);
  if (ent.hasAthleteAccess || ent.hasOperatorAccess) return;
  throw new TrainingRouteAuthError(402, "subscription_required");
}
