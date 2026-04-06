import { NextRequest, NextResponse } from "next/server";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import { mapAthleteProfileRow } from "@/lib/profile/map-athlete-profile-row";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const SELECT =
  "id, first_name, last_name, email, birth_date, sex, timezone, activity_level, height_cm, weight_kg, training_days_per_week, training_max_session_minutes, updated_at";

/**
 * Fase 5 — riga `athlete_profiles` per atleta attivo (lettura con stesso accesso degli altri moduli).
 */
export async function GET(req: NextRequest) {
  const client = createSupabaseCookieClient();
  if (!client) {
    return NextResponse.json(
      { ok: false as const, error: "supabase_unconfigured", profile: null },
      { status: 503, headers: NO_STORE },
    );
  }

  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json(
      { ok: false as const, error: "unauthorized", profile: null },
      { status: 401, headers: NO_STORE },
    );
  }

  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  if (!athleteId) {
    return NextResponse.json(
      { ok: false as const, error: "missing_athleteId", profile: null },
      { status: 400, headers: NO_STORE },
    );
  }

  const allowed = await canAccessAthleteData(client, user.id, athleteId, null);
  if (!allowed) {
    return NextResponse.json(
      { ok: false as const, error: "forbidden", profile: null },
      { status: 403, headers: NO_STORE },
    );
  }

  const { data: row, error } = await client.from("athlete_profiles").select(SELECT).eq("id", athleteId).maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false as const, error: error.message, profile: null },
      { status: 500, headers: NO_STORE },
    );
  }

  const profile = mapAthleteProfileRow(row);

  return NextResponse.json(
    {
      ok: true as const,
      athleteId,
      profile,
    },
    { headers: NO_STORE },
  );
}
