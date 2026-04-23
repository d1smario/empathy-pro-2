import type { SupabaseClient } from "@supabase/supabase-js";
import { coachOrgIdForDb } from "@/lib/coach-org-id";

async function athleteIdByNormalizedEmail(supabase: SupabaseClient, email: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("athlete_profile_id_by_normalized_email", { p_email: email });
  if (error) {
    const { data: row } = await supabase
      .from("athlete_profiles")
      .select("id")
      .eq("email", email)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    return row && typeof row.id === "string" ? row.id : null;
  }
  return typeof data === "string" ? data : null;
}

async function resolveExistingAthleteId(
  supabase: SupabaseClient,
  athleteId: string | null,
  email: string | null,
): Promise<string | null> {
  if (athleteId) {
    const { data } = await supabase.from("athlete_profiles").select("id").eq("id", athleteId).maybeSingle();
    if (data && typeof (data as { id?: string }).id === "string") {
      return (data as { id: string }).id;
    }
  }
  if (email) {
    return athleteIdByNormalizedEmail(supabase, email);
  }
  return null;
}

export type BootstrapAppUserProfileInput = {
  userId: string;
  role: "private" | "coach";
  email: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Solo coach: se valorizzato, upsert coach_athletes. Mai implicito da email. */
  athleteId?: string | null;
};

/**
 * Allinea `app_user_profiles` (+ opzionale `coach_athletes`) come `POST /api/access/ensure-profile`.
 * Usabile da Route Handler con client Supabase già autenticato (cookie session).
 */
export async function bootstrapAppUserProfile(
  supabase: SupabaseClient,
  input: BootstrapAppUserProfileInput,
): Promise<{ error: string | null }> {
  const role = input.role;
  const email = String(input.email ?? "").trim().toLowerCase() || null;
  const firstName = String(input.firstName ?? "").trim() || null;
  const lastName = String(input.lastName ?? "").trim() || null;
  const explicitAthleteId = typeof input.athleteId === "string" ? input.athleteId.trim() : "";
  const athleteId = explicitAthleteId || null;

  const { data: existing, error: existingErr } = await supabase
    .from("app_user_profiles")
    .select("role, athlete_id, platform_coach_status")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (existingErr) {
    return { error: existingErr.message };
  }

  const current = existing as {
    role: "private" | "coach";
    athlete_id: string | null;
    platform_coach_status?: string | null;
  } | null;

  let resolvedAthleteId: string | null;
  if (role === "coach") {
    resolvedAthleteId = athleteId ? await resolveExistingAthleteId(supabase, athleteId, null) : null;
  } else {
    resolvedAthleteId = await resolveExistingAthleteId(supabase, athleteId ?? current?.athlete_id ?? null, email);
  }

  if (role === "private" && !resolvedAthleteId) {
    const { data: inserted, error: insErr } = await supabase.from("athlete_profiles").insert({
      email,
      first_name: firstName,
      last_name: lastName,
      activity_level: "advanced",
      timezone: "Europe/Rome",
    }).select("id").maybeSingle();
    if (insErr) {
      if (insErr.code === "23505" && email) {
        resolvedAthleteId = await athleteIdByNormalizedEmail(supabase, email);
      }
      if (!resolvedAthleteId) {
        return { error: insErr.message };
      }
    } else {
      const row = inserted as { id?: string } | null;
      resolvedAthleteId = row?.id ?? null;
    }
  }

  const nextRole = role;
  const nextAthleteId = nextRole === "private" ? resolvedAthleteId : null;

  let nextPlatformCoachStatus: string | null = null;
  if (nextRole === "coach") {
    const prev = current?.platform_coach_status ?? null;
    if (prev === "approved" || prev === "suspended" || prev === "pending") {
      nextPlatformCoachStatus = prev;
    } else {
      nextPlatformCoachStatus = "pending";
    }
  }

  const shouldUpsertProfile =
    !current ||
    current.role !== nextRole ||
    (current.athlete_id ?? null) !== (nextAthleteId ?? null) ||
    (current.platform_coach_status ?? null) !== (nextPlatformCoachStatus ?? null);

  if (shouldUpsertProfile) {
    const { error: profileErr } = await supabase.from("app_user_profiles").upsert(
      {
        user_id: input.userId,
        role: nextRole,
        athlete_id: nextAthleteId,
        platform_coach_status: nextPlatformCoachStatus,
      },
      { onConflict: "user_id" },
    );
    if (profileErr) {
      return { error: profileErr.message };
    }
  }

  if (nextRole === "coach" && resolvedAthleteId) {
    const orgId = coachOrgIdForDb();
    const { error: linkErr } = await supabase.from("coach_athletes").upsert(
      { org_id: orgId, coach_user_id: input.userId, athlete_id: resolvedAthleteId },
      { onConflict: "org_id,coach_user_id,athlete_id" },
    );
    if (linkErr) {
      return { error: linkErr.message };
    }
  }

  return { error: null };
}
