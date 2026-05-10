import "server-only";

import type { InterpretationStagingBundle } from "@/lib/memory/interpretation-staging-contract";

/** Payload shape returned with food-photo estimate — commit to diary/FDC stays on existing finalize paths. */
export type FoodPhotoEstimateStagingPayload = {
  label_it: string;
  portion_g_estimate: number | null;
  kcal_estimate: number | null;
  carbs_g: number | null;
  protein_g: number | null;
  fat_g: number | null;
  fdc_search_hint: string | null;
  notes_it: string | null;
};

/**
 * L2 staging bundle for vision food estimate: findings + structured proposal only.
 * No DB write — UI / finalize flow applies via nutrition diary pipeline.
 */
export function buildFoodPhotoInterpretationStaging(input: {
  athleteId: string;
  estimate: FoodPhotoEstimateStagingPayload;
}): InterpretationStagingBundle {
  return {
    athleteId: input.athleteId,
    createdAtIso: new Date().toISOString(),
    findings: [
      {
        topic: "food_photo_estimate",
        summary: `Stima visiva: ${input.estimate.label_it}`,
        sources: [
          { kind: "athlete_memory", label: "athleteId", ref: input.athleteId },
          { kind: "manual", label: "OpenAI vision JSON", ref: null },
        ],
        confidence: 0.55,
      },
    ],
    proposedStructuredPatches: { foodPhotoEstimate: input.estimate },
  };
}
