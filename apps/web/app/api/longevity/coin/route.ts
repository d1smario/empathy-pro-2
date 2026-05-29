import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { computeCoinBalanceFromRows } from "@/lib/epi/coin-ledger";

export const runtime = "nodejs";

/** Derived Empathy Coin balance + tier + recent ledger entries for an athlete. */
export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
    const { db } = await requireAthleteReadContext(req, athleteId);

    const { data, error } = await db
      .from("empathy_coin_ledger")
      .select("id, earned_for_date, coins, reason, epi_score, created_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const balance = computeCoinBalanceFromRows(athleteId, rows);
    return NextResponse.json({ athleteId, balance, ledger: rows });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Unable to read coin balance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
