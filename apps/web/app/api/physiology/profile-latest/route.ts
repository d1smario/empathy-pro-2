import { NextRequest, NextResponse } from "next/server";
import { physiologicalProfileFromDbRow, type PhysiologicalProfileDbRow } from "@empathy/domain-physiology";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Ultima riga grezza `physiological_profiles` (solo cookie session).
 *
 * @deprecated Preferire `GET /api/physiology/profile` (`resolveCanonicalPhysiologyState`) o
 * `fetchCanonicalPhysiologyProfile` lato client per allineamento twin/builder.
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

  const { data: row, error } = await client
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
}
