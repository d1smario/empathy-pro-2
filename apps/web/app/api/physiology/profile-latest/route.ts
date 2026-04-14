import { NextRequest, NextResponse } from "next/server";
import { physiologicalProfileFromDbRow, type PhysiologicalProfileDbRow } from "@empathy/domain-physiology";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Ultima riga grezza `physiological_profiles`.
 *
 * @deprecated Preferire `GET /api/physiology/profile` (`resolveCanonicalPhysiologyState`) o
 * `fetchCanonicalPhysiologyProfile` lato client per allineamento twin/builder.
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

    const { data: row, error } = await db
      .from("physiological_profiles")
      .select(
        "id, athlete_id, ftp_watts, cp_watts, lt1_watts, lt1_heart_rate, lt2_watts, lt2_heart_rate, v_lamax, vo2max_ml_min_kg, economy, baseline_hrv_ms, valid_from, valid_to, updated_at",
      )
      .eq("athlete_id", athleteId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false as const, error: error.message, profile: null },
        { status: 500, headers: NO_STORE },
      );
    }

    const profile = row ? physiologicalProfileFromDbRow(row as PhysiologicalProfileDbRow) : null;

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
