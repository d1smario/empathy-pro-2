import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { buildPhysiologyDailyPanel } from "@/lib/physiology/daily-wellness-panel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pannello giornaliero wellness / fisiologia operativa: merge `device_sync_exports` (giorno logico) +
 * `athlete_profiles.weight_kg` + `biomarker_panels` per `sample_date`.
 */
export async function GET(req: NextRequest) {
  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  const date = (req.nextUrl.searchParams.get("date") ?? "").trim().slice(0, 10);

  if (!athleteId) {
    return NextResponse.json({ ok: false as const, error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
  }
  if (!ISO_DAY.test(date)) {
    return NextResponse.json({ ok: false as const, error: "invalid_date" }, { status: 400, headers: NO_STORE });
  }

  try {
    const { db } = await requireAthleteReadContext(req, athleteId);
    const panel = await buildPhysiologyDailyPanel({ db, athleteId, date });
    return NextResponse.json(panel, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      if (err.status === 503) {
        return NextResponse.json({ ok: false as const, error: "supabase_unconfigured" }, { status: 503, headers: NO_STORE });
      }
      if (err.status === 401) {
        return NextResponse.json({ ok: false as const, error: "unauthorized" }, { status: 401, headers: NO_STORE });
      }
      if (err.status === 403) {
        return NextResponse.json({ ok: false as const, error: "forbidden" }, { status: 403, headers: NO_STORE });
      }
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    throw err;
  }
}
