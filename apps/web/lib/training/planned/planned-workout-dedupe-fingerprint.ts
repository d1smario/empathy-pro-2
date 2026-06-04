import { BUILDER_SESSION_JSON_TAG } from "@/lib/training/builder/pro2-session-contract";
import { dedupePlannedTrainingForNutritionEnergy } from "@/lib/nutrition/planned-training-energy-dedupe";

export type PlannedWorkoutDedupeInput = {
  type: string;
  duration_minutes: number;
  tss_target: number;
  kcal_target: number | null;
  notes: string | null;
};

export type PlannedWorkoutDbDedupeRow = PlannedWorkoutDedupeInput & {
  id?: string;
  date?: string;
  created_at?: string | null;
};

/**
 * Fingerprint stabile per il guardrail canonico su `planned_workouts`:
 * stesso atleta + giorno + fingerprint ⇒ una sola riga (evita doppio conteggio in nutrition).
 */
export function plannedWorkoutDedupeFingerprint(row: PlannedWorkoutDedupeInput): string {
  const notes = row.notes ?? "";

  const importMatch = notes.match(/\[EMPATHY_IMPORT:checksum=([a-f0-9]+)\]/i);
  if (importMatch) return `import:${importMatch[1]!.toLowerCase()}`;

  const importSha1Match = notes.match(/import_sha1=([a-f0-9]+)/i);
  if (importSha1Match) return `import_sha1:${importSha1Match[1]!.toLowerCase()}`;

  const idx = notes.indexOf(BUILDER_SESSION_JSON_TAG);
  if (idx >= 0) {
    const payload = notes
      .slice(idx + BUILDER_SESSION_JSON_TAG.length)
      .split(/\s*\|\s*/)[0]
      ?.trim();
    if (payload) return `builder:${payload}`;
  }

  const kcal = row.kcal_target ?? 0;
  return `ops:${row.type.trim()}|${row.duration_minutes}|${row.tss_target}|${kcal}`;
}

export function isPro2BuilderPlannedNotes(notes: string | null | undefined): boolean {
  const t = notes ?? "";
  return t.includes("[PRO2_BUILDER") || t.includes(BUILDER_SESSION_JSON_TAG);
}

/** Griglia calendario lite (senza `notes` in SELECT): riconosce builder da `type` (`pro2_builder_*`). */
export function isPro2BuilderPlannedRow(row: {
  notes?: string | null;
  type?: string | null;
}): boolean {
  if (isPro2BuilderPlannedNotes(row.notes)) return true;
  return String(row.type ?? "")
    .trim()
    .toLowerCase()
    .startsWith("pro2_builder");
}

function pickLatestPlannedWorkoutRow<T extends PlannedWorkoutDbDedupeRow>(rows: T[]): T {
  return [...rows].sort((a, b) => {
    const ca = String(a.created_at ?? "");
    const cb = String(b.created_at ?? "");
    if (ca !== cb) return ca.localeCompare(cb);
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  })[rows.length - 1]!;
}

/** Dedupe read-side (calendario + nutrition): stesse regole del guardrail write. */
export function dedupePlannedWorkoutDbRows<T extends PlannedWorkoutDbDedupeRow>(rows: T[]): T[] {
  if (rows.length <= 1) return rows;

  const byDay = new Map<string, T[]>();
  for (const row of rows) {
    const day = String(row.date ?? "").slice(0, 10) || "unknown";
    const list = byDay.get(day) ?? [];
    list.push(row);
    byDay.set(day, list);
  }

  const out: T[] = [];
  for (const dayRows of byDay.values()) {
    out.push(...dedupePlannedWorkoutDbRowsForSingleDay(dayRows));
  }
  return out.sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
}

function dedupePlannedWorkoutDbRowsForSingleDay<T extends PlannedWorkoutDbDedupeRow>(rows: T[]): T[] {
  if (rows.length <= 1) return rows;

  const fingerprintGroups = new Map<string, T[]>();
  for (const row of rows) {
    const fp = plannedWorkoutDedupeFingerprint(row);
    const group = fingerprintGroups.get(fp) ?? [];
    group.push(row);
    fingerprintGroups.set(fp, group);
  }
  let kept: T[] = [];
  for (const group of fingerprintGroups.values()) {
    kept.push(pickLatestPlannedWorkoutRow(group));
  }

  const builderByType = new Map<string, T[]>();
  const nonBuilder: T[] = [];
  for (const row of kept) {
    if (!isPro2BuilderPlannedRow(row)) {
      nonBuilder.push(row);
      continue;
    }
    const typeKey = String(row.type ?? "").trim() || "pro2_builder";
    const group = builderByType.get(typeKey) ?? [];
    group.push(row);
    builderByType.set(typeKey, group);
  }
  const builderKept: T[] = [];
  for (const group of builderByType.values()) {
    builderKept.push(pickLatestPlannedWorkoutRow(group));
  }
  kept = [...nonBuilder, ...builderKept];

  return dedupePlannedTrainingForNutritionEnergy(
    kept.map((row) => ({
      ...row,
      durationMinutes: row.duration_minutes,
      tssTarget: row.tss_target,
      kcalTarget: row.kcal_target,
      notes: row.notes,
    })),
  ) as T[];
}
