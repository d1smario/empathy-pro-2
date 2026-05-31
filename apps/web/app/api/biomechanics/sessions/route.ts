import { NextRequest, NextResponse } from "next/server";

import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import {
  listBiomechanicsCaptureJobs,
  listBiomechanicsSessionImports,
  listPendingBiomechanicsStagingRuns,
} from "@/lib/biomechanics/biomech-capture-pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

export async function GET(req: NextRequest) {
  try {
    const athleteId = String(req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "missing_athleteId" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteReadContext(req, athleteId);
    const [sessions, captureJobs, pendingStaging] = await Promise.all([
      listBiomechanicsSessionImports(db, athleteId),
      listBiomechanicsCaptureJobs(db, athleteId),
      listPendingBiomechanicsStagingRuns(db, athleteId),
    ]);

    return NextResponse.json({ ok: true, sessions, captureJobs, pendingStaging }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "biomech_sessions_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
