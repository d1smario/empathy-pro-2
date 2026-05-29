import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { resolveEpiForDate } from "@/lib/epi/epi-resolver";
import { awardEfficientDay, loadCoinBalance } from "@/lib/epi/coin-ledger";

export const runtime = "nodejs";

/**
 * Deterministic efficient-day award entry point. Idempotent at the DB level
 * (unique athlete_id+earned_for_date+reason). Reuses the single EPI resolver + ledger helper
 * (no parallel award logic). Body: { athleteId, date? }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { athleteId?: string; date?: string };
    const athleteId = (body.athleteId ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    const date = (body.date ?? "").trim() || undefined;

    const { db } = await requireAthleteWriteContext(req, athleteId);
    const { epi, snapshotDate } = await resolveEpiForDate(athleteId, date);

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

    const award = await awardEfficientDay(db, athleteId, epi, snapshotDate, null);
    const balance = await loadCoinBalance(db, athleteId);

    return NextResponse.json({ athleteId, snapshotDate, awarded: award.awarded, coins: award.coins, epiScore: epi.score, balance });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unable to award coins";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
