import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { buildPhysiologyDailyPanel } from "@/lib/physiology/daily-wellness-panel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pannello “giornata” canonico (sonno, recovery, attività, biomarker spot) per l’atleta.
 * Riusa `buildPhysiologyDailyPanel` come fonte unica per evitare logiche parallele tra
 * Calendar (`CalendarDayWellnessDetail`) e Physiology daily.
 */
export async function GET(req: NextRequest) {
  const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
  const dateRaw = (req.nextUrl.searchParams.get("date") ?? "").trim();
  const date = dateRaw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";

  if (!athleteId) {
    return NextResponse.json(
      { ok: false as const, error: "missing_athleteId" },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!ISO_DATE.test(date)) {
    return NextResponse.json(
      { ok: false as const, error: "missing_or_invalid_date" },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const { db } = await requireAthleteReadContext(req, athleteId);
    const panel = await buildPhysiologyDailyPanel({ db, athleteId, date });
    return NextResponse.json(panel, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      const code =
        err.status === 503
          ? "supabase_unconfigured"
          : err.status === 401
            ? "unauthorized"
            : err.status === 403
              ? "forbidden"
              : err.message;
      return NextResponse.json(
        { ok: false as const, error: code },
        { status: err.status, headers: NO_STORE },
      );
    }
    const message = err instanceof Error ? err.message : "daily-wellness failed";
    return NextResponse.json(
      { ok: false as const, error: message },
      { status: 500, headers: NO_STORE },
    );
  }
}
