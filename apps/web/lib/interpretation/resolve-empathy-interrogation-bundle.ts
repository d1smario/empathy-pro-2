import type { EmpathyInterrogationBundle } from "@empathy/contracts";
import { buildEmpathyInterrogationMap } from "@/lib/interpretation/build-empathy-interrogation-map";
import {
  buildEmpathyApplicationPlaybook,
  type BuildEmpathyApplicationPlaybookInput,
} from "@/lib/interpretation/empathy-application-playbook";
import type { BuildEmpathyInterrogationMapInput } from "@/lib/interpretation/build-empathy-interrogation-map";

export type ResolveEmpathyInterrogationBundleInput = BuildEmpathyInterrogationMapInput &
  Pick<
    BuildEmpathyApplicationPlaybookInput,
    "nutritionPerformanceIntegration" | "dailyEnergyModel"
  >;

export function resolveEmpathyInterrogationBundle(
  input: ResolveEmpathyInterrogationBundleInput,
): EmpathyInterrogationBundle {
  const interrogationMap = buildEmpathyInterrogationMap(input);
  const applicationPlaybook = buildEmpathyApplicationPlaybook({
    athleteId: input.athleteId,
    anchorDate: input.anchorDate,
    interrogationMap,
    plannedSessions: input.plannedSessions,
    pathwayModulation: input.pathwayModulation,
    healthLabBridge: input.healthLabBridge,
    recoverySummary: input.recoverySummary,
    nutritionPerformanceIntegration: input.nutritionPerformanceIntegration,
    dailyEnergyModel: input.dailyEnergyModel,
  });
  return { interrogationMap, applicationPlaybook };
}
