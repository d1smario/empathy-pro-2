import type { SupabaseClient } from "@supabase/supabase-js";
import { coachOrgIdForDb } from "@/lib/coach-org-id";

/**
 * Gate unico atleta: **stesso significato** di `requireRequestAthleteAccess` (Pro 2).
 * - Profilo con `athlete_id` uguale al target → accesso (atleta “proprio”).
 * - Altrimenti solo **coach** con riga in `coach_athletes` per `org_id`.
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
  const linkedAthleteId = typeof p.athlete_id === "string" ? p.athlete_id : null;
  if (linkedAthleteId === athleteId) return true;
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
