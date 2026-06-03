import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { buildOperationalDayHub } from "@/lib/operational/build-operational-day-hub";
import { ServerTiming, serverTimingNow } from "@/lib/http/server-timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/** Single-day operational hub: training window + daily energy + fueling analysis. */
export async function GET(req: NextRequest) {
  const timing = new ServerTiming();
  const t0 = serverTimingNow();
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const date = (req.nextUrl.searchParams.get("date") ?? "").trim();
    if (!athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { ok: false as const, error: "Missing or invalid athleteId/date" },
        { status: 400, headers: NO_STORE },
      );
    }

    const tAuth = serverTimingNow();
    const { db } = await requireAthleteReadContext(req, athleteId);
    timing.mark("auth", tAuth, "athlete read context");

    const tHub = serverTimingNow();
    const payload = await buildOperationalDayHub({ db, athleteId, date });
    timing.mark("hub", tHub, "day hub build");

    if (!payload.ok) {
      return NextResponse.json(payload, { status: 500, headers: NO_STORE });
    }

    timing.mark("total", t0, "operational day-hub");
    const res = NextResponse.json(payload, { headers: NO_STORE });
    timing.applyTo(res.headers);
    return res;
  } catch (error) {
    if (error instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: error.message }, { status: error.status, headers: NO_STORE });
    }
    console.error("operational day-hub failed", error);
    return NextResponse.json({ ok: false as const, error: "day_hub_failed" }, { status: 500, headers: NO_STORE });
  }
}
