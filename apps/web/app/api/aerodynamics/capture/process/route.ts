import { NextRequest, NextResponse } from "next/server";

import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { processAerodynamicsCaptureJob } from "@/lib/aerodynamics/aero-capture-process-pipeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { athleteId?: string; jobId?: string };
    const athleteId = String(body.athleteId ?? "").trim();
    const jobId = String(body.jobId ?? "").trim();

    if (!athleteId || !jobId) {
      return NextResponse.json({ error: "missing_athleteId_or_jobId" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);
    const result = await processAerodynamicsCaptureJob(db, { athleteId, jobId });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code, message: result.message },
        { status: 422, headers: NO_STORE },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        stagingRunId: result.stagingRunId,
        jobId: result.jobId,
        confidence01: result.confidence01,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "aero_process_failed";
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
