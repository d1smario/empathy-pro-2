import type { AthleteAerodynamicsMemory, AthleteBiomechanicsMemory } from "@/lib/empathy/schemas";
import { computeHumanEfficiencyScoreV1, type HumanEfficiencyScoreV1 } from "@empathy/domain-human-efficiency";

export function buildHumanEfficiencyFromLabMemory(input: {
  athleteId: string;
  biomechanics?: AthleteBiomechanicsMemory | null;
  aerodynamics?: AthleteAerodynamicsMemory | null;
  physiologicalReadiness01?: number | null;
}): HumanEfficiencyScoreV1 | null {
  return computeHumanEfficiencyScoreV1({
    athleteId: input.athleteId,
    biomechanicsSnapshot: input.biomechanics?.latestSnapshot ?? null,
    aerodynamicsSnapshot: input.aerodynamics?.latestSnapshot ?? null,
    physiologicalReadiness01: input.physiologicalReadiness01 ?? null,
  });
}
