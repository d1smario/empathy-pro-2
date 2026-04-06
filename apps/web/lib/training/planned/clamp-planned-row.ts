/** Allineamento soft ai guardrail V1 — senza dipendere da `planned-operational-guardrail` (porting incrementale). */
export type PlannedWorkoutInsertPayload = {
  athlete_id: string;
  date: string;
  type: string;
  duration_minutes: number;
  tss_target: number;
  kcal_target: number | null;
  kj_target?: number | null;
  notes: string | null;
};

export function clampPlannedWorkoutRow(row: PlannedWorkoutInsertPayload): PlannedWorkoutInsertPayload {
  const type = row.type.trim().slice(0, 120) || "pro2_builder";
  const duration = Math.max(1, Math.min(360, Math.round(Number(row.duration_minutes) || 0)));
  const tss = Math.max(0, Math.min(999, Math.round(Number(row.tss_target) || 0)));
  let kcal: number | null = null;
  if (row.kcal_target != null && Number.isFinite(Number(row.kcal_target))) {
    kcal = Math.max(0, Math.min(20000, Math.round(Number(row.kcal_target))));
  }
  let kj: number | null = null;
  if (row.kj_target != null && Number.isFinite(Number(row.kj_target))) {
    kj = Math.max(0, Math.min(50000, Math.round(Number(row.kj_target))));
  }
  return {
    athlete_id: row.athlete_id.trim(),
    date: row.date.trim().slice(0, 10),
    type,
    duration_minutes: duration,
    tss_target: tss,
    kcal_target: kcal,
    kj_target: kj,
    notes: row.notes && row.notes.trim() ? row.notes.trim().slice(0, 32000) : null,
  };
}
