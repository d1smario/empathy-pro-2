import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { mapAthleteProfileRow } from "@/lib/profile/map-athlete-profile-row";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const SELECT =
  "id, first_name, last_name, email, birth_date, sex, timezone, activity_level, height_cm, weight_kg, training_days_per_week, training_max_session_minutes, updated_at";

/**
 * Fase 5 — riga `athlete_profiles` per atleta attivo (lettura con stesso accesso degli altri moduli).
 */
export async function GET(req: NextRequest) {
  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  if (!athleteId) {
    return NextResponse.json(
      { ok: false as const, error: "missing_athleteId", profile: null },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const { db } = await requireAthleteReadContext(req, athleteId);

    const { data: row, error } = await db.from("athlete_profiles").select(SELECT).eq("id", athleteId).maybeSingle();

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
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      if (err.status === 503) {
        return NextResponse.json(
          { ok: false as const, error: "supabase_unconfigured", profile: null },
          { status: 503, headers: NO_STORE },
        );
      }
      if (err.status === 401) {
        return NextResponse.json(
          { ok: false as const, error: "unauthorized", profile: null },
          { status: 401, headers: NO_STORE },
        );
      }
      if (err.status === 403) {
        return NextResponse.json(
          { ok: false as const, error: "forbidden", profile: null },
          { status: 403, headers: NO_STORE },
        );
      }
      return NextResponse.json(
        { ok: false as const, error: err.message, profile: null },
        { status: err.status, headers: NO_STORE },
      );
    }
    throw err;
  }
}
