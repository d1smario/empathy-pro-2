import type { SupabaseClient } from "@supabase/supabase-js";
import type { AthleteEvidenceMemoryItem } from "@/lib/empathy/schemas";

export const COACH_APPLICATION_EVIDENCE_SOURCE = "coach_manual_action";

/**
 * Tabella assente o non ancora nel cache schema PostgREST (es. migrazione 035 non applicata).
 * Diversamente da `42P01` / "does not exist", Supabase può rispondere con "schema cache".
 */
export function isMissingRelationError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  const code = String((error as { code?: string }).code ?? "");
  if (code === "42P01") return true;
  if (msg.includes("does not exist")) return true;
  if (msg.includes("schema cache") && msg.includes("could not find")) return true;
  if (msg.includes("could not find the table")) return true;
  return false;
}

export type CoachApplicationTraceRow = {
  id: string;
  athlete_id: string;
  manual_action_id: string;
  action_type: string;
  payload_snapshot: Record<string, unknown>;
  created_by_user_id: string;
  created_at: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/** Maps DB rows → evidence items consumed by `resolveAthleteMemory` (prepended before knowledge_evidence_hits). */
export function coachApplicationTraceRowsToEvidenceItems(rows: Array<Record<string, unknown>>): AthleteEvidenceMemoryItem[] {
  return rows.map((row) => {
    const snap = asRecord(row.payload_snapshot);
    const values = asRecord(snap.values);
    const target = asString(values.target);
    const action = asString(values.action);
    const titleParts = [asString(row.action_type).replaceAll("_", " "), target, action].filter(Boolean);
    return {
      id: asString(row.id),
      source: COACH_APPLICATION_EVIDENCE_SOURCE,
      query: asString(row.manual_action_id),
      title: titleParts.length ? `Applicazione coach · ${titleParts.slice(0, 3).join(" · ")}` : "Applicazione coach",
      summary:
        typeof snap.reason === "string" && snap.reason.trim()
          ? snap.reason.trim().slice(0, 400)
          : JSON.stringify(snap).slice(0, 400),
      evidenceClass: "validated_coach_application",
      module: String(row.action_type ?? "").includes("nutrition")
        ? "nutrition"
        : String(row.action_type ?? "").includes("physiology")
          ? "physiology"
          : "training",
      domain: target || "cross_module",
      adaptationTarget: action || undefined,
      confidence: typeof values.confidence === "number" && Number.isFinite(values.confidence) ? values.confidence : undefined,
      payload: {
        manualActionId: row.manual_action_id,
        actionType: row.action_type,
        snapshot: snap,
      },
      createdAt: asString(row.created_at),
    };
  });
}

export async function fetchCoachApplicationTraces(
  supabase: SupabaseClient,
  athleteId: string,
  limit = 24,
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from("athlete_coach_application_traces")
    .select("id, athlete_id, manual_action_id, action_type, payload_snapshot, created_by_user_id, created_at")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as Array<Record<string, unknown>>;
}

export async function insertCoachApplicationTrace(input: {
  supabase: SupabaseClient;
  athleteId: string;
  manualActionId: string;
  actionType: string;
  payloadSnapshot: Record<string, unknown>;
  createdByUserId: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string; duplicate?: boolean }> {
  const { data, error } = await input.supabase
    .from("athlete_coach_application_traces")
    .insert({
      athlete_id: input.athleteId,
      manual_action_id: input.manualActionId,
      action_type: input.actionType,
      payload_snapshot: input.payloadSnapshot,
      created_by_user_id: input.createdByUserId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    const code = String((error as { code?: string }).code ?? "");
    if (code === "23505") {
      return { ok: false, error: error.message, duplicate: true };
    }
    if (isMissingRelationError(error)) {
      return { ok: false, error: "athlete_coach_application_traces table missing; apply migration 035." };
    }
    return { ok: false, error: error.message };
  }
  const id = data && typeof data === "object" && "id" in data ? asString((data as { id?: unknown }).id) : "";
  if (!id) return { ok: false, error: "insert_ok_but_no_id" };
  return { ok: true, id };
}
