/**
 * Percorso condiviso Builder + VIRYA: motore → nomi esercizi → righe scheda da catalogo.
 */

import type { AdaptationTarget } from "@/lib/training/engine/types";
import type { Pro2GymManualRow } from "@/lib/training/builder/pro2-gym-manual-plan";
import {
  buildPro2GymRowsFromCatalog,
  extractPreferredExerciseNamesFromBlockExercises,
} from "@/lib/training/builder/pro2-gym-catalog-plan";
import type { BuilderCatalogExerciseRow } from "@/modules/training/services/training-builder-catalog-api";

export function buildPro2GymManualRowsFromEngine(input: {
  blockExercises: unknown;
  catalogRows: BuilderCatalogExerciseRow[];
  sportTag: string;
  adaptation: AdaptationTarget;
  executionStyle: string;
  targetDistrictLabels?: string[];
}): Pro2GymManualRow[] {
  const preferred = extractPreferredExerciseNamesFromBlockExercises(input.blockExercises);
  let rows = buildPro2GymRowsFromCatalog({
    sourceRows: input.catalogRows,
    activeSportTag: input.sportTag,
    adaptation: input.adaptation,
    executionStyle: input.executionStyle,
    preferredExerciseNames: preferred.length ? preferred : undefined,
    targetDistrictLabels: input.targetDistrictLabels,
  });
  if (!rows.length && input.targetDistrictLabels?.length) {
    rows = buildPro2GymRowsFromCatalog({
      sourceRows: input.catalogRows,
      activeSportTag: input.sportTag,
      adaptation: input.adaptation,
      executionStyle: input.executionStyle,
      preferredExerciseNames: preferred.length ? preferred : undefined,
    });
  }
  if (!rows.length) {
    rows = buildPro2GymRowsFromCatalog({
      sourceRows: input.catalogRows,
      activeSportTag: input.sportTag,
      adaptation: input.adaptation,
      executionStyle: input.executionStyle,
    });
  }
  return rows;
}

/** Ultimo tentativo: catalogo senza filtro distretti né nomi motore. */
export function buildPro2GymRowsCatalogOnly(input: {
  catalogRows: BuilderCatalogExerciseRow[];
  sportTag: string;
  adaptation: AdaptationTarget;
  executionStyle: string;
}): Pro2GymManualRow[] {
  return buildPro2GymRowsFromCatalog({
    sourceRows: input.catalogRows,
    activeSportTag: input.sportTag,
    adaptation: input.adaptation,
    executionStyle: input.executionStyle,
  });
}
