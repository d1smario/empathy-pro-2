import type { GeneratedSession } from "@/lib/training/engine";
import { mapEngineSessionToPlannedRow } from "@/lib/training/planned/map-engine-session-to-planned";

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

  const res = await fetch("/api/training/planned/insert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
