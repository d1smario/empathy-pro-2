import { NextRequest, NextResponse } from "next/server";
import {
  AthleteReadContextError,
  requireAuthenticatedTrainingUser,
  requireAthleteWriteContext,
  supabaseForAthleteTableRead,
} from "@/lib/auth/athlete-read-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

type StagingAction = "committed" | "rejected" | "archived";

function isStagingAction(value: string): value is StagingAction {
  return value === "committed" || value === "rejected" || value === "archived";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const runId = params.id.trim();
    const body = (await req.json().catch(() => ({}))) as { status?: string; reason?: string };
    const status = String(body.status ?? "").trim();
    const reason = typeof body.reason === "string" ? body.reason.trim() : null;

    if (!runId) {
      return NextResponse.json({ ok: false as const, error: "missing_run_id" }, { status: 400, headers: NO_STORE });
    }
    if (!isStagingAction(status)) {
      return NextResponse.json({ ok: false as const, error: "invalid_status" }, { status: 400, headers: NO_STORE });
    }

    const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
    const readDb = supabaseForAthleteTableRead(rlsClient);
    const { data: run, error: runErr } = await readDb
      .from("interpretation_staging_runs")
      .select("id, athlete_id, domain, status, source_refs, candidate_bundle")
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

    const { error: updateErr } = await db
      .from("interpretation_staging_runs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("athlete_id", athleteId);
    if (updateErr) {
      return NextResponse.json({ ok: false as const, error: updateErr.message }, { status: 500, headers: NO_STORE });
    }

    if (status === "committed" || status === "rejected") {
      const { error: auditErr } = await db.from("interpretation_staging_commits").insert({
        run_id: runId,
        athlete_id: athleteId,
        target: "evidence",
        target_ids: [],
        status,
        reason,
        payload: {
          domain: run.domain,
          prior_status: run.status,
          source_refs: run.source_refs,
          candidate_bundle: run.candidate_bundle,
        },
        committed_by: userId,
      });
      if (auditErr) {
        return NextResponse.json({ ok: false as const, error: auditErr.message }, { status: 500, headers: NO_STORE });
      }
    }

    return NextResponse.json({ ok: true as const, id: runId, status }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "health_staging_patch_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
