import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
type ManualActionScope = "coach" | "private";
type StagingStatus = "draft" | "ready" | "pending_validation" | StagingAction;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isStagingAction(value: string): value is StagingAction {
  return value === "committed" || value === "rejected" || value === "archived";
}

function isStagingStatus(value: unknown): value is StagingStatus {
  return (
    value === "draft" ||
    value === "ready" ||
    value === "pending_validation" ||
    value === "committed" ||
    value === "rejected" ||
    value === "archived"
  );
}

function canTransitionStagingRun(from: StagingStatus, to: StagingAction): boolean {
  if (from === to) return true;
  if (from === "committed" || from === "rejected") return false;
  if (from === "archived") return to === "archived";
  return true;
}

function manualActionTypeForTarget(target: string): string {
  const t = target.toLowerCase();
  if (t.includes("nutrition")) return "nutrition_staging_patch";
  if (t.includes("physiology") || t.includes("bioenergetics")) return "physiology_staging_patch";
  if (t.includes("health") || t.includes("redox") || t.includes("microbiota") || t.includes("epigenetic")) {
    return "physiology_staging_patch";
  }
  return "training_staging_patch";
}

async function scopeForUser(input: {
  readDb: ReturnType<typeof supabaseForAthleteTableRead>;
  userId: string;
  athleteId: string;
}): Promise<ManualActionScope> {
  const { data } = await input.readDb
    .from("app_user_profiles")
    .select("role, athlete_id")
    .eq("user_id", input.userId)
    .maybeSingle();
  const role = typeof data?.role === "string" ? data.role : "";
  if (role === "coach") return "coach";
  return "private";
}

async function queueManualActionsFromCommittedStaging(input: {
  db: Awaited<ReturnType<typeof requireAthleteWriteContext>>["db"];
  athleteId: string;
  runId: string;
  userId: string;
  scope: ManualActionScope;
  run: Record<string, unknown>;
  reason: string | null;
}): Promise<number> {
  const patches = asArray(input.run.proposed_structured_patches);
  if (!patches.length) return 0;

  const now = new Date().toISOString();
  const rows = patches.map((patch, index) => {
    const p = asRecord(patch);
    const target = typeof p.target === "string" && p.target.trim() ? p.target.trim() : "training";
    const action = typeof p.action === "string" && p.action.trim() ? p.action.trim() : "review_staging_patch";
    return {
      id: randomUUID(),
      athlete_id: input.athleteId,
      created_by_user_id: input.userId,
      scope: input.scope,
      action_type: manualActionTypeForTarget(target),
      status: "pending",
      reason: input.reason ?? `interpretation_staging:${input.runId}`,
      payload: {
        athleteId: input.athleteId,
        reason: input.reason,
        values: {
          stagingRunId: input.runId,
          patchIndex: index,
          target,
          action,
          reason: p.reason ?? null,
          triggerSource: input.run.trigger_source ?? null,
          confidence: input.run.confidence ?? null,
          sourceRefs: input.run.source_refs ?? [],
          candidateBundle: input.run.candidate_bundle ?? null,
          proposedPatch: p,
        },
      },
      created_at: now,
    };
  });

  const { error } = await input.db.from("manual_actions").insert(rows);
  if (error) {
    const msg = error.message ?? "";
    if (error.code === "42P01" || msg.includes("does not exist")) return 0;
    throw new Error(error.message);
  }
  return rows.length;
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
      .select("id, athlete_id, domain, status, trigger_source, source_refs, candidate_bundle, proposed_structured_patches, confidence")
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
    const priorStatus = isStagingStatus(run.status) ? run.status : null;
    if (!priorStatus) {
      return NextResponse.json({ ok: false as const, error: "invalid_prior_status" }, { status: 409, headers: NO_STORE });
    }
    if (priorStatus === status) {
      return NextResponse.json({ ok: true as const, id: runId, status, unchanged: true as const }, { headers: NO_STORE });
    }
    if (!canTransitionStagingRun(priorStatus, status)) {
      return NextResponse.json(
        { ok: false as const, error: "invalid_status_transition", from: priorStatus, to: status },
        { status: 409, headers: NO_STORE },
      );
    }

    const { error: updateErr } = await db
      .from("interpretation_staging_runs")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", runId)
      .eq("athlete_id", athleteId);
    if (updateErr) {
      return NextResponse.json({ ok: false as const, error: updateErr.message }, { status: 500, headers: NO_STORE });
    }

    let manualActionsQueued = 0;
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
          trigger_source: run.trigger_source,
          source_refs: run.source_refs,
          candidate_bundle: run.candidate_bundle,
          proposed_structured_patches: run.proposed_structured_patches,
          confidence: run.confidence,
        },
        committed_by: userId,
      });
      if (auditErr) {
        return NextResponse.json({ ok: false as const, error: auditErr.message }, { status: 500, headers: NO_STORE });
      }
    }

    if (status === "committed") {
      const scope = await scopeForUser({ readDb, userId, athleteId });
      manualActionsQueued = await queueManualActionsFromCommittedStaging({
        db,
        athleteId,
        runId,
        userId,
        scope,
        run,
        reason,
      });
    }

    return NextResponse.json({ ok: true as const, id: runId, status, manualActionsQueued }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ ok: false as const, error: err.message }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "health_staging_patch_failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500, headers: NO_STORE });
  }
}
