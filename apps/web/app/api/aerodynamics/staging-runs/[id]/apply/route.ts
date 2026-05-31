import { NextRequest, NextResponse } from "next/server";

import {
  AthleteReadContextError,
  requireAthleteWriteContext,
  requireAuthenticatedTrainingUser,
  supabaseForAthleteTableRead,
} from "@/lib/auth/athlete-read-context";
import { applyAerodynamicsStagingRun, rejectAerodynamicsStagingRun } from "@/lib/aerodynamics/aero-staging-apply";
import { invalidateAthleteMemoryCache } from "@/lib/memory/athlete-memory-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const runId = params.id?.trim();
    if (!runId) {
      return NextResponse.json({ ok: false as const, error: "missing_run_id" }, { status: 400, headers: NO_STORE });
    }

    const body = (await req.json().catch(() => ({}))) as { reason?: string; selectedScenarioId?: string };
    const reason = typeof body.reason === "string" ? body.reason.trim() : null;
    const selectedScenarioId =
      typeof body.selectedScenarioId === "string" ? body.selectedScenarioId.trim() : null;

    const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
    const readDb = supabaseForAthleteTableRead(rlsClient);
    const { data: run, error: runErr } = await readDb
      .from("interpretation_staging_runs")
      .select("id, athlete_id, domain, status")
      .eq("id", runId)
      .maybeSingle();

    if (runErr) {
      return NextResponse.json({ ok: false as const, error: runErr.message }, { status: 500, headers: NO_STORE });
    }
    if (!run) {
      return NextResponse.json({ ok: false as const, error: "staging_run_not_found" }, { status: 404, headers: NO_STORE });
    }

    const athleteId = String(run.athlete_id ?? "");
    const { db } = await requireAthleteWriteContext(req, athleteId);

    const result = await applyAerodynamicsStagingRun({ db, athleteId, runId, userId, reason, selectedScenarioId });

    if (!result.ok) {
      return NextResponse.json({ ok: false as const, error: result.error }, { status: 409, headers: NO_STORE });
    }

    invalidateAthleteMemoryCache(athleteId);

    return NextResponse.json(
      {
        ok: true as const,
        runId,
        testSessionId: result.testSessionId,
        jobId: result.jobId,
        cdaM2: result.cdaM2,
        scores: result.scores,
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "aero_staging_apply_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const runId = params.id?.trim();
    const body = (await req.json().catch(() => ({}))) as { status?: string; reason?: string };
    const status = String(body.status ?? "").trim();
    const reason = typeof body.reason === "string" ? body.reason.trim() : null;

    if (!runId) {
      return NextResponse.json({ ok: false as const, error: "missing_run_id" }, { status: 400, headers: NO_STORE });
    }
    if (status !== "rejected") {
      return NextResponse.json({ ok: false as const, error: "invalid_status" }, { status: 400, headers: NO_STORE });
    }

    const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
    const readDb = supabaseForAthleteTableRead(rlsClient);
    const { data: run, error: runErr } = await readDb
      .from("interpretation_staging_runs")
      .select("id, athlete_id")
      .eq("id", runId)
      .maybeSingle();

    if (runErr) {
      return NextResponse.json({ ok: false as const, error: runErr.message }, { status: 500, headers: NO_STORE });
    }
    if (!run) {
      return NextResponse.json({ ok: false as const, error: "staging_run_not_found" }, { status: 404, headers: NO_STORE });
    }

    const athleteId = String(run.athlete_id ?? "");
    const { db } = await requireAthleteWriteContext(req, athleteId);
    const result = await rejectAerodynamicsStagingRun({ db, athleteId, runId, userId, reason });

    if (!result.ok) {
      return NextResponse.json({ ok: false as const, error: result.error }, { status: 409, headers: NO_STORE });
    }

    invalidateAthleteMemoryCache(athleteId);
    return NextResponse.json({ ok: true as const, id: runId, status: "rejected" }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "aero_staging_patch_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
