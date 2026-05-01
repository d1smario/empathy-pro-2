import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { ManualActionStatus } from "@/api/manual-actions/contracts";
import { AthleteReadContextError, requireAthleteWriteContext } from "@/lib/auth/athlete-read-context";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function isValidStatus(status: string): status is ManualActionStatus {
  return ["pending", "applied", "rejected", "superseded"].includes(status);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function canTransitionManualAction(from: ManualActionStatus, to: ManualActionStatus): boolean {
  if (from === to) return true;
  if (from === "applied" || from === "rejected" || from === "superseded") return false;
  return to !== "pending";
}

function lockScopeFromActionType(actionType: string): string {
  if (actionType.includes("nutrition")) return "nutrition";
  if (actionType.includes("biomechanics")) return "biomechanics";
  if (actionType.includes("aerodynamics")) return "aerodynamics";
  if (actionType.includes("physiology")) return "physiology";
  return "training";
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actionId = params.id;
    const body = (await req.json()) as { status?: string; reason?: string };
    const status = body.status ?? "";
    if (!isValidStatus(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data: actionRow, error: actionErr } = await supabase
      .from("manual_actions")
      .select("id, athlete_id, created_by_user_id, action_type, payload, status, reason")
      .eq("id", actionId)
      .maybeSingle();
    if (actionErr) return NextResponse.json({ error: actionErr.message }, { status: 500 });
    if (!actionRow) return NextResponse.json({ error: "Manual action not found" }, { status: 404 });

    await requireAthleteWriteContext(req, String(actionRow.athlete_id));
    const priorStatus = isValidStatus(String(actionRow.status ?? "")) ? (actionRow.status as ManualActionStatus) : null;
    if (!priorStatus) {
      return NextResponse.json({ error: "Invalid prior status" }, { status: 409 });
    }
    if (priorStatus === status) {
      return NextResponse.json({ actionId, status, unchanged: true });
    }
    if (!canTransitionManualAction(priorStatus, status)) {
      return NextResponse.json({ error: "Invalid status transition", from: priorStatus, to: status }, { status: 409 });
    }

    const updatePayload: { status: ManualActionStatus; reason?: string; applied_at?: string } = {
      status,
    };
    if (typeof body.reason === "string" && body.reason.trim()) updatePayload.reason = body.reason.trim();
    if (status === "applied") updatePayload.applied_at = new Date().toISOString();

    if (status === "applied") {
      const lockScope = lockScopeFromActionType(String(actionRow.action_type ?? ""));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error: lockErr } = await supabase.from("athlete_update_locks").upsert(
        {
          id: randomUUID(),
          athlete_id: actionRow.athlete_id,
          scope: lockScope,
          locked_by_user_id: actionRow.created_by_user_id,
          reason: `manual_action:${actionId}`,
          expires_at: expiresAt,
        },
        { onConflict: "athlete_id,scope" },
      );
      if (lockErr) return NextResponse.json({ error: lockErr.message }, { status: 500 });
    }

    const { error } = await supabase.from("manual_actions").update(updatePayload).eq("id", actionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const payload = asRecord(actionRow.payload);
    const values = asRecord(payload.values);
    const stagingRunId = asString(values.stagingRunId);
    if (stagingRunId && (status === "applied" || status === "rejected")) {
      const { error: auditErr } = await supabase.from("interpretation_staging_commits").insert({
        run_id: stagingRunId,
        athlete_id: actionRow.athlete_id,
        target: status === "applied" ? "athlete_memory_trace" : "evidence",
        target_ids: [actionId],
        status: status === "applied" ? "committed" : "rejected",
        reason: updatePayload.reason ?? actionRow.reason ?? `manual_action:${status}`,
        payload: {
          manual_action_id: actionId,
          prior_status: priorStatus,
          action_type: actionRow.action_type,
          payload,
        },
        committed_by: actionRow.created_by_user_id,
      });
      if (auditErr) return NextResponse.json({ error: auditErr.message }, { status: 500 });
    }

    return NextResponse.json({ actionId, status });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Manual action patch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
