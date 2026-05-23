import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { coachOrgIdForDb } from "@/lib/coach-org-id";
import { assertPlatformEntitlementForApi } from "@/lib/billing/assert-platform-entitlement";
import { coachOperationalApproved } from "@/lib/platform-coach-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedTrainingUser, TrainingRouteAuthError } from "@/lib/auth/training-route-auth";

export type CoachLibraryWriteContext = {
  userId: string;
  orgId: string;
  db: SupabaseClient;
};

/**
 * Libreria sedute: solo coach operativo approvato (stesso gate di roster/inviti).
 * Usa service role se disponibile; altrimenti client RLS (policy own coach_user_id).
 */
export async function requireCoachLibraryWriteContext(req: NextRequest): Promise<CoachLibraryWriteContext> {
  const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
  await assertPlatformEntitlementForApi(userId, rlsClient);

  const { data: profile, error } = await rlsClient
    .from("app_user_profiles")
    .select("role, platform_coach_status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new TrainingRouteAuthError(500, error.message);
  }

  const row = profile as { role?: string; platform_coach_status?: string | null } | null;
  if (row?.role !== "coach") {
    throw new TrainingRouteAuthError(403, "coach_only");
  }
  if (!coachOperationalApproved("coach", row?.platform_coach_status)) {
    throw new TrainingRouteAuthError(403, "coach_not_approved");
  }

  const admin = createSupabaseAdminClient();
  return {
    userId,
    orgId: coachOrgIdForDb(),
    db: admin ?? rlsClient,
  };
}
