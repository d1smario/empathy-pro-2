import { NextResponse } from "next/server";
import { dedupeAthletesByEmail, type CanonicalAthleteRow } from "@/lib/athletes/canonical-profile";
import { coachOrgIdForDb } from "@/lib/coach-org-id";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const SELECT =
  "id, email, first_name, last_name, height_cm, weight_kg, sex, diet_type, training_days_per_week, training_max_session_minutes, created_at";

/**
 * Elenco atleti visibili al contesto corrente (private: collegato; coach: `coach_athletes` filtrato per `org_id` risolto).
 */
export async function GET() {
  const client = createSupabaseCookieClient();
  if (!client) {
    return NextResponse.json(
      { ok: false as const, error: "supabase_unconfigured", role: "private" as const, athletes: [] },
      { status: 503, headers: NO_STORE },
    );
  }

  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json(
      { ok: false as const, error: "unauthorized", role: "private" as const, athletes: [] },
      { status: 401, headers: NO_STORE },
    );
  }

  const { data: profileData, error: profileError } = await client
    .from("app_user_profiles")
    .select("role, athlete_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { ok: false as const, error: profileError.message, role: "private" as const, athletes: [] },
      { status: 500, headers: NO_STORE },
    );
  }

  const prof = profileData as { role?: string; athlete_id?: string | null } | null;
  let role: "private" | "coach" = "private";
  if (prof?.role === "coach" || prof?.role === "private") {
    role = prof.role;
  }

  let athleteIds: string[] = [];

  if (role === "coach") {
    const { data: linkedRows, error: linkedError } = await client
      .from("coach_athletes")
      .select("athlete_id")
      .eq("coach_user_id", user.id)
      .eq("org_id", coachOrgIdForDb());
    if (linkedError) {
      return NextResponse.json(
        { ok: false as const, error: linkedError.message, role, athletes: [] },
        { status: 500, headers: NO_STORE },
      );
    }
    athleteIds = Array.from(
      new Set(
        (linkedRows ?? [])
          .map((row) => String((row as { athlete_id?: string }).athlete_id ?? "").trim())
          .filter(Boolean),
      ),
    );
  } else if (prof?.athlete_id) {
    athleteIds = [String(prof.athlete_id)];
  }

  if (!athleteIds.length) {
    return NextResponse.json({ ok: true as const, role, athletes: [] }, { headers: NO_STORE });
  }

  const { data, error } = await client
    .from("athlete_profiles")
    .select(SELECT)
    .in("id", athleteIds)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false as const, error: error.message, role, athletes: [] },
      { status: 500, headers: NO_STORE },
    );
  }

  const athletes = dedupeAthletesByEmail((data ?? []) as CanonicalAthleteRow[]);

  return NextResponse.json({ ok: true as const, role, athletes }, { headers: NO_STORE });
}
