import type { SupabaseClient } from "@supabase/supabase-js";
import { BUILDER_SESSION_JSON_TAG } from "@/lib/training/builder/pro2-session-contract";
import { clampPlannedWorkoutRow, type PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";
import {
  isPro2BuilderPlannedRow,
  plannedWorkoutDedupeFingerprint,
} from "@/lib/training/planned/planned-workout-dedupe-fingerprint";

/**
 * **Unica scrittura canonica** su `planned_workouts` (Pro 2).
 *
 * Regole obbligatorie — non bypassare con `.insert()` diretto:
 * 1. Stesso fingerprint (atleta + giorno) ⇒ niente seconda riga; ritorna id esistente.
 * 2. Seduta builder sul giorno ⇒ sostituisce altre righe builder dello stesso `type` (re-save / ripubblicazione).
 *
 * Motivazione: doppioni operativi sballano nutrition / meal plan (TSS+kcal sommati due volte).
 */
export function toPlannedWorkoutInsertRecord(row: PlannedWorkoutInsertPayload): Record<string, unknown> {
  const clamped = clampPlannedWorkoutRow(row);
  const payload: Record<string, unknown> = {
    athlete_id: clamped.athlete_id,
    date: clamped.date,
    type: clamped.type,
    duration_minutes: clamped.duration_minutes,
    tss_target: clamped.tss_target,
    kcal_target: clamped.kcal_target,
    notes: clamped.notes,
  };
  if (clamped.kj_target != null) payload.kj_target = clamped.kj_target;
  return payload;
}

export type InsertPlannedWorkoutResult = {
  id: string | null;
  dedupeSkipped?: boolean;
  replacedSameTypeCount?: number;
};

async function findExistingPlannedWorkoutByFingerprint(
  db: SupabaseClient,
  row: PlannedWorkoutInsertPayload,
): Promise<string | null> {
  const clamped = clampPlannedWorkoutRow(row);
  const targetFp = plannedWorkoutDedupeFingerprint(clamped);
  const { data, error } = await db
    .from("planned_workouts")
    .select("id,type,duration_minutes,tss_target,kcal_target,notes")
    .eq("athlete_id", clamped.athlete_id)
    .eq("date", clamped.date);
  if (error) throw new Error(error.message);
  for (const existing of data ?? []) {
    const rec = existing as {
      id?: string;
      type?: string;
      duration_minutes?: number;
      tss_target?: number;
      kcal_target?: number | null;
      notes?: string | null;
    };
    if (typeof rec.id !== "string") continue;
    const fp = plannedWorkoutDedupeFingerprint({
      type: String(rec.type ?? ""),
      duration_minutes: Number(rec.duration_minutes ?? 0),
      tss_target: Number(rec.tss_target ?? 0),
      kcal_target: rec.kcal_target ?? null,
      notes: rec.notes ?? null,
    });
    if (fp === targetFp) return rec.id;
  }
  return null;
}

async function replaceBuilderPlannedSameTypeOnDay(
  db: SupabaseClient,
  row: PlannedWorkoutInsertPayload,
): Promise<number> {
  const clamped = clampPlannedWorkoutRow(row);
  if (!isPro2BuilderPlannedRow(clamped)) return 0;
  const { data, error } = await db
    .from("planned_workouts")
    .delete()
    .eq("athlete_id", clamped.athlete_id)
    .eq("date", clamped.date)
    .eq("type", clamped.type)
    .ilike("notes", `%${BUILDER_SESSION_JSON_TAG}%`)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function insertSinglePlannedWorkout(
  db: SupabaseClient,
  row: PlannedWorkoutInsertPayload,
): Promise<InsertPlannedWorkoutResult> {
  const clamped = clampPlannedWorkoutRow(row);
  const existingId = await findExistingPlannedWorkoutByFingerprint(db, clamped);
  if (existingId) {
    return { id: existingId, dedupeSkipped: true };
  }

  let replacedSameTypeCount = 0;
  if (isPro2BuilderPlannedRow(clamped)) {
    replacedSameTypeCount = await replaceBuilderPlannedSameTypeOnDay(db, clamped);
  }

  const payload = toPlannedWorkoutInsertRecord(clamped);
  const { data, error } = await db.from("planned_workouts").insert(payload).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  const id = data && typeof (data as { id?: unknown }).id === "string" ? (data as { id: string }).id : null;
  return { id, replacedSameTypeCount: replacedSameTypeCount > 0 ? replacedSameTypeCount : undefined };
}

/** Batch con le stesse regole obbligatorie del singolo insert (Virya, import tabellare, ecc.). */
export async function insertPlannedWorkoutRows(
  db: SupabaseClient,
  rows: PlannedWorkoutInsertPayload[],
): Promise<{ ids: string[]; dedupeSkippedCount: number; replacedSameTypeCount: number }> {
  const ids: string[] = [];
  let dedupeSkippedCount = 0;
  let replacedSameTypeCount = 0;
  for (const row of rows) {
    const result = await insertSinglePlannedWorkout(db, row);
    if (result.id) ids.push(result.id);
    if (result.dedupeSkipped) dedupeSkippedCount += 1;
    if (result.replacedSameTypeCount) replacedSameTypeCount += result.replacedSameTypeCount;
  }
  return { ids, dedupeSkippedCount, replacedSameTypeCount };
}
