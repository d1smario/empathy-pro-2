import { NextRequest, NextResponse } from "next/server";

import {
  AthleteReadContextError,
  requireAthleteWriteContext,
} from "@/lib/auth/athlete-read-context";
import type { BiomechanicsDiscipline } from "@empathy/contracts";
import { importBiomechanicsOpenCapSession } from "@/lib/biomechanics/biomech-import-staging-pipeline";
import { invalidateAthleteMemoryCache } from "@/lib/memory/athlete-memory-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

const DISCIPLINES = new Set<BiomechanicsDiscipline>([
  "cycling",
  "running",
  "walking",
  "gym",
  "movement_screening",
]);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      athleteId?: string;
      externalSessionId?: string;
      discipline?: string;
      provider?: string;
    };

    const athleteId = String(body.athleteId ?? "").trim();
    const externalSessionId = String(body.externalSessionId ?? "").trim();
    const discipline = String(body.discipline ?? "movement_screening").trim() as BiomechanicsDiscipline;

    if (!athleteId || !externalSessionId) {
      return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400, headers: NO_STORE });
    }
    if (!DISCIPLINES.has(discipline)) {
      return NextResponse.json({ ok: false, error: "invalid_discipline" }, { status: 400, headers: NO_STORE });
    }

    const { db } = await requireAthleteWriteContext(req, athleteId);
    const result = await importBiomechanicsOpenCapSession(db, {
      athleteId,
      externalSessionId,
      discipline,
      provider: body.provider === "opencap" ? "opencap" : "opencap",
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code, message: result.message },
        { status: 422, headers: NO_STORE },
      );
    }

    invalidateAthleteMemoryCache(athleteId);

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
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "biomech_import_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: NO_STORE });
  }
}
