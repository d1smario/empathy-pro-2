import type { Block1MusclePreset, ExerciseCatalogFile, ExerciseSelectorQuery, UnifiedExerciseRecord } from "./types";
import { matchesBlock1MusclePreset } from "./block1-taxonomy";

function normalizeToken(s: string): string {
  return s.trim().toLowerCase();
}

export function selectExercises(catalog: ExerciseCatalogFile, query: ExerciseSelectorQuery): UnifiedExerciseRecord[] {
  const limit = query.limit ?? 12;
  const { primarySystem, energySystem, movementPattern, equipmentIncludes, sportTag } = query;

  return catalog.exercises
    .filter((ex) => {
      if (primarySystem && normalizeToken(ex.physiology.primarySystem) !== normalizeToken(primarySystem)) return false;
      if (energySystem && normalizeToken(ex.physiology.energySystem) !== normalizeToken(energySystem)) return false;
      if (movementPattern && normalizeToken(ex.movementPattern) !== normalizeToken(movementPattern)) return false;
      if (sportTag && !ex.sportTags.some((t) => normalizeToken(t) === normalizeToken(sportTag))) return false;
      if (equipmentIncludes) {
        const q = normalizeToken(equipmentIncludes);
        const ok = ex.equipment.some((e) => normalizeToken(e).includes(q));
        if (!ok) return false;
      }
      return true;
    })
    .slice(0, limit);
}

export function dedupeBySlug(exercises: UnifiedExerciseRecord[]): UnifiedExerciseRecord[] {
  const seen = new Map<string, UnifiedExerciseRecord>();
  for (const ex of exercises) {
    if (!seen.has(ex.slug)) seen.set(ex.slug, ex);
    else {
      const cur = seen.get(ex.slug)!;
      /** Preferisci record con media e più provenance */
      const score = (e: UnifiedExerciseRecord) =>
        (e.media?.gifUrl ? 2 : 0) + e.provenance.length * 3 + e.muscleGroups.length;
      if (score(ex) > score(cur)) seen.set(ex.slug, ex);
    }
  }
  return Array.from(seen.values());
}

/** Dopo selectExercises: restringi per macro-area muscolare (catalogo in inglese). */
export function filterByBlock1MusclePreset(exercises: UnifiedExerciseRecord[], preset: Block1MusclePreset): UnifiedExerciseRecord[] {
  if (!preset) return exercises;
  return exercises.filter((ex) => matchesBlock1MusclePreset(ex, preset));
}
