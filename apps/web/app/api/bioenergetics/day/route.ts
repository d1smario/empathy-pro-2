import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { assembleBioenergeticDay } from "@/lib/bioenergetics/bioenergetic-day-assembler";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

function isoDateOrToday(raw: string): string {
  const date = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Query: `athleteId` (obbl.), `date` (YYYY-MM-DD, default oggi), `stripAudit=1` (opz.: JSON `monitoringStripAuditV1` con input curve). Versioning: `dayContractVersion` nel body. */
export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }
    const date = isoDateOrToday(req.nextUrl.searchParams.get("date") ?? "");
    const stripAudit = req.nextUrl.searchParams.get("stripAudit") === "1";
    const { db } = await requireAthleteReadContext(req, athleteId);

    const result = await assembleBioenergeticDay(db, athleteId, date, { stripAudit });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
    }

    return NextResponse.json(result.body, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "bioenergetics_day_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
