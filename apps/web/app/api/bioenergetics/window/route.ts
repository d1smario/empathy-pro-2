import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { assembleBioenergeticWindow } from "@/lib/bioenergetics/bioenergetic-day-assembler";
import { BIOENERGETIC_WINDOW_MAX_DAYS } from "@/lib/bioenergetics/bioenergetic-window-range";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** Query: `athleteId`, `from`, `to` (`YYYY-MM-DD`, max inclusivo `BIOENERGETIC_WINDOW_MAX_DAYS` giorni). */
export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const from = (req.nextUrl.searchParams.get("from") ?? "").trim().slice(0, 10);
    const to = (req.nextUrl.searchParams.get("to") ?? "").trim().slice(0, 10);
    if (!athleteId) {
      return NextResponse.json({ error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: "missing_or_invalid_from_to" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteReadContext(req, athleteId);

    const result = await assembleBioenergeticWindow(db, athleteId, from, to);
    if (!result.ok) {
      const status = result.status === 400 ? 400 : 500;
      return NextResponse.json(
        { error: result.error, maxDays: BIOENERGETIC_WINDOW_MAX_DAYS },
        { status, headers: NO_STORE },
      );
    }

    return NextResponse.json(result.body, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "bioenergetics_window_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
