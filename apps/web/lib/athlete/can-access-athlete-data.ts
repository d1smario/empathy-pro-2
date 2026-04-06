import type { SupabaseClient } from "@supabase/supabase-js";
import { coachOrgIdForDb } from "@/lib/coach-org-id";

/**
 * Private: proprio athlete_id. Coach: riga in coach_athletes per `org_id` (env o default seed migration).
 */
export async function canAccessAthleteData(
  client: SupabaseClient,
  userId: string,
  athleteId: string,
  orgId: string | null,
): Promise<boolean> {
  const { data: prof, error } = await client
    .from("app_user_profiles")
    .select("role, athlete_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !prof) return false;

  const p = prof as { role?: string; athlete_id?: string | null };
  if (p.role === "private" && p.athlete_id === athleteId) return true;
  if (p.role !== "coach") return false;

  const resolvedOrg = orgId ?? coachOrgIdForDb();
  const { data: links, error: linkErr } = await client
    .from("coach_athletes")
    .select("athlete_id")
    .eq("coach_user_id", userId)
    .eq("athlete_id", athleteId)
    .eq("org_id", resolvedOrg)
    .limit(1);
  if (linkErr) return false;
  return Boolean(links?.length);
}
