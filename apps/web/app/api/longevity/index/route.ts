import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { resolveEpiForDate } from "@/lib/epi/epi-resolver";
import { awardEfficientDay, loadCoinBalance } from "@/lib/epi/coin-ledger";

export const runtime = "nodejs";

/**
 * Compute the EPI (Health Index) for a date, persist a versioned snapshot, award the efficient-day
 * coin (idempotent), and return the result + derived coin balance. Single EPI surface.
 */
export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    const date = (req.nextUrl.searchParams.get("date") ?? "").trim() || undefined;
    const persist = req.nextUrl.searchParams.get("persist") !== "false";

    const { db } = await requireAthleteWriteContext(req, athleteId);
    const { epi, checkin, snapshotDate } = await resolveEpiForDate(athleteId, date);

    if (persist) {
      const { error: snapError } = await db.from("epi_snapshots").upsert(
        {
          athlete_id: athleteId,
          snapshot_date: snapshotDate,
          captured_at: new Date().toISOString(),
          algorithm_version: epi.algorithmVersion,
          epi_score: epi.score,
          confidence: epi.confidence,
          data_tier: epi.dataTier,
          illness_flag: epi.illnessDay,
          efficient_day: epi.efficientDay,
          pillars: epi.pillars,
          inputs_provenance: epi.provenance,
        },
        { onConflict: "athlete_id,snapshot_date,algorithm_version" },
      );
      if (snapError) return NextResponse.json({ error: snapError.message }, { status: 500 });

      await awardEfficientDay(db, athleteId, epi, snapshotDate, null);
    }

    const balance = await loadCoinBalance(db, athleteId);

    return NextResponse.json({ athleteId, snapshotDate, epi, checkin, balance });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unable to resolve EPI";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
