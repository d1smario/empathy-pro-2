import type { ExerciseCatalogFile } from "./types";
import catalogJson from "@/data/exercises/final/exercise-library.json";
import { BLOCK1_GENERATED_EXERCISES } from "./block1-generated";

/** Catalogo unificato V1 (build-time) — Pro 2: stesso JSON, senza dipendenze asset generati. */
export function loadUnifiedExerciseCatalog(): ExerciseCatalogFile {
  const baseCatalog = catalogJson as ExerciseCatalogFile;
  const exercises = [...baseCatalog.exercises, ...BLOCK1_GENERATED_EXERCISES];
  return {
    ...baseCatalog,
    count: exercises.length,
    exercises,
  };
}
