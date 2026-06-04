import type { GeneratedSession } from "@/lib/training/engine";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { invalidatePlannedWindowCacheForAthlete } from "@/lib/training/planned-window-client-cache";
import { mapEngineSessionToPlannedRow } from "@/lib/training/planned/map-engine-session-to-planned";
import type { TrainingPlannerCalendarReplaceInput, TrainingPlannerCalendarReplaceResult } from "@/api/training/contracts";

/** Persistenza sul calendario operativo: ogni insert finisce in `planned_workouts` (stessa sorgente letta da `GET /api/training/planned-window`). */

function shiftIsoCalendarDay(isoDay: string, deltaDays: number): string {
  const key = isoDay.trim().slice(0, 10);
  const base = new Date(`${key}T12:00:00`);
  if (Number.isNaN(base.getTime())) return key;
  base.setDate(base.getDate() + deltaDays);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

/** Dopo insert: stesso endpoint del Calendario — se la riga non compare, la UI non può mostrarla. */
export async function verifyPlannedWorkoutReadable(input: {
  athleteId: string;
  date: string;
  plannedWorkoutId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const day = input.date.trim().slice(0, 10);
  const id = input.plannedWorkoutId?.trim();
  if (!id || id === "ok") {
    return { ok: false, error: "Salvataggio completato ma senza id riga: impossibile allineare il calendario." };
  }
  const headers = await buildSupabaseAuthHeaders();
  const q = new URLSearchParams({
    athleteId: input.athleteId.trim(),
    from: shiftIsoCalendarDay(day, -2),
    to: shiftIsoCalendarDay(day, 2),
    includePlanned: "1",
    includeExecuted: "0",
    includePlannedNotes: "0",
    includeTraceSummary: "0",
    includeAthleteContext: "0",
  });
  const res = await fetch(`/api/training/planned-window?${q}`, {
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; planned?: Array<{ id?: string }> };
  if (!res.ok || json.ok !== true) {
    return { ok: false, error: json.error ?? "Lettura calendario non riuscita dopo il salvataggio." };
  }
  const planned = Array.isArray(json.planned) ? json.planned : [];
  if (!planned.some((row) => row.id === id)) {
    return {
      ok: false,
      error: `Riga creata (id ${id.slice(0, 8)}…) ma non leggibile dal calendario per il ${day}. Verifica l’atleta attivo e riprova.`,
    };
  }
  return { ok: true };
}

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
  const athleteId = String(json.athleteId ?? input.athleteId);
  invalidatePlannedWindowCacheForAthlete(athleteId);
  return {
    ok: true,
    athleteId,
    plannedWorkoutId: json.plannedWorkoutId ?? null,
  };
}

/**
 * `athleteId` obbligatorio (stesso valore usato in `planned-window`): il DELETE allinea il probe RLS alla lettura calendario.
 * In Network → risposta DELETE controlla header `x-empathy-delete-probe`.
 */
export async function patchPlannedWorkout(input: {
  id: string;
  athleteId: string;
  patch: {
    date?: string;
    duration_minutes?: number;
    tss_target?: number;
    kcal_target?: number | null;
    notes?: string | null;
    type?: string;
  };
}): Promise<void> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/training/planned", {
    method: "PATCH",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({
      id: input.id,
      athleteId: input.athleteId,
      patch: input.patch,
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? "Aggiornamento seduta pianificata non riuscito");
  }
}

export async function deletePlannedWorkoutsOnDate(input: {
  athleteId: string;
  date: string;
}): Promise<{ deletedOnDateCount: number }> {
  const athleteId = input.athleteId.trim();
  const date = input.date.trim().slice(0, 10);
  if (!athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("athleteId e data (YYYY-MM-DD) richiesti per eliminare il giorno.");
  }
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/training/planned", {
    method: "DELETE",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ athleteId, deleteAllOnDate: date }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    errorCode?: string;
    deletedOnDateCount?: number;
    deleteHints?: Record<string, unknown>;
  };
  if (!res.ok) {
    const extra = [json.errorCode, json.deleteHints ? JSON.stringify(json.deleteHints) : ""].filter(Boolean).join(" · ");
    throw new Error([json.error ?? "Eliminazione giorno non riuscita", extra].filter(Boolean).join(" — "));
  }
  return { deletedOnDateCount: json.deletedOnDateCount ?? 0 };
}

export async function deletePlannedWorkout(input: {
  id: string;
  athleteId: string;
  /** Sedute VIRYA: elimina anche duplicati stesso giorno + tag in `notes`. */
  purgeViryaDayDuplicates?: boolean;
  /** Rimuove tutte le righe con tag `[VIRYA:…]` (piano intero). */
  deleteViryaPlanTag?: string;
}): Promise<{
  alreadyDeleted?: boolean;
  purgedViryaDayDuplicates?: number;
  deletedViryaPlanRows?: number;
}> {
  const hint = input.athleteId.trim();
  if (!hint) {
    throw new Error("athleteId mancante: impossibile allineare DELETE a planned-window.");
  }
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/training/planned", {
    method: "DELETE",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({
      id: input.id.trim(),
      athleteId: hint,
      purgeViryaDayDuplicates: input.purgeViryaDayDuplicates === true,
      deleteViryaPlanTag: input.deleteViryaPlanTag?.trim().startsWith("[VIRYA:")
        ? input.deleteViryaPlanTag.trim()
        : undefined,
    }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    errorCode?: string;
    alreadyDeleted?: boolean;
    deleteHints?: Record<string, unknown>;
  };
  if (!res.ok) {
    const probe = res.headers.get("x-empathy-delete-probe");
    const hints =
      json.deleteHints && Object.keys(json.deleteHints).length > 0
        ? JSON.stringify(json.deleteHints)
        : "";
    const extra = [json.errorCode, probe, hints].filter(Boolean).join(" · ");
    throw new Error([json.error ?? "Eliminazione seduta pianificata non riuscita", extra].filter(Boolean).join(" — "));
  }
  const payload = json as {
    purgedViryaDayDuplicates?: number;
    deletedViryaPlanRows?: number;
  };
  return {
    alreadyDeleted: json.alreadyDeleted === true,
    purgedViryaDayDuplicates:
      typeof payload.purgedViryaDayDuplicates === "number" ? payload.purgedViryaDayDuplicates : 0,
    deletedViryaPlanRows:
      typeof payload.deletedViryaPlanRows === "number" ? payload.deletedViryaPlanRows : 0,
  };
}

export type ViryaCalendarPlanSummary = {
  tag: string;
  planName: string;
  sessionCount: number;
  dateMin: string;
  dateMax: string;
};

export async function fetchViryaCalendarPlans(athleteId: string): Promise<ViryaCalendarPlanSummary[]> {
  const headers = await buildSupabaseAuthHeaders();
  const q = new URLSearchParams({ athleteId: athleteId.trim() });
  const res = await fetch(`/api/training/virya/plans?${q}`, {
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { plans?: ViryaCalendarPlanSummary[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Caricamento piani VIRYA non riuscito");
  return json.plans ?? [];
}

export async function deleteViryaCalendarPlan(input: { athleteId: string; tag: string }): Promise<number> {
  const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch("/api/training/virya/plans", {
    method: "DELETE",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ athleteId: input.athleteId.trim(), tag: input.tag.trim() }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { deletedCount?: number; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Eliminazione piano VIRYA non riuscita");
  return json.deletedCount ?? 0;
}

export async function replaceTrainingPlannerCalendar(
  input: TrainingPlannerCalendarReplaceInput,
): Promise<TrainingPlannerCalendarReplaceResult> {
  const response = await fetch("/api/training/planned", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      athleteId: input.athleteId,
      replaceTag: input.replaceTag,
      rows: input.rows,
      generationAudit: input.generationAudit,
    }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Replace VIRYA planned workouts failed");
  }
  const result = (await response.json()) as TrainingPlannerCalendarReplaceResult;
  invalidatePlannedWindowCacheForAthlete(input.athleteId.trim());
  return result;
}
