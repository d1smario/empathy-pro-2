import type { GeneratedSession } from "@/lib/training/engine";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { mapEngineSessionToPlannedRow } from "@/lib/training/planned/map-engine-session-to-planned";

/** Persistenza sul calendario operativo: ogni insert finisce in `planned_workouts` (stessa sorgente letta da `GET /api/training/planned-window`). */

export type InsertPlannedResponse =
  | { ok: true; athleteId: string; plannedWorkoutId: string | null }
  | { ok: false; error: string };

export async function insertPlannedWorkoutFromEngineSession(input: {
  athleteId: string;
  date: string;
  session: GeneratedSession;
  /** Righe aggiuntive in `notes` (es. `BUILDER_SESSION_JSON::…`). */
  extraNotesLines?: string[];
  /** Durata pianificata scelta dal coach (builder manuale). */
  plannedDurationMinutesOverride?: number | null;
}): Promise<InsertPlannedResponse> {
  const row = mapEngineSessionToPlannedRow({
    athleteId: input.athleteId,
    date: input.date,
    session: input.session,
    extraNotesLines: input.extraNotesLines,
    plannedDurationMinutesOverride: input.plannedDurationMinutesOverride,
  });

  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/training/planned/insert", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ row }),
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as Partial<InsertPlannedResponse> & { error?: string };
  if (!res.ok || json.ok !== true) {
    return { ok: false, error: json.error ?? "Insert planned failed" };
  }
  return {
    ok: true,
    athleteId: String(json.athleteId ?? input.athleteId),
    plannedWorkoutId: json.plannedWorkoutId ?? null,
  };
}

/** `athleteId` opzionale: il server risolve `athlete_id` dalla riga (`id`) per evitare mismatch con contesto UI. */
export async function deletePlannedWorkout(input: { id: string; athleteId?: string | null }): Promise<void> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const body: { id: string; athleteId?: string } = { id: input.id };
  if (input.athleteId?.trim()) body.athleteId = input.athleteId.trim();
  const res = await fetch("/api/training/planned", {
    method: "DELETE",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? "Eliminazione seduta pianificata non riuscita");
  }
}
