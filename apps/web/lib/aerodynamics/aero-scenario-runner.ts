import type { AerodynamicsScenarioCompareV1 } from "@empathy/contracts";

import type { AeroGeometryProposalV1 } from "@/lib/aerodynamics/aero-geometry-cv-adapter";
import {
  buildPositionScenarioMatrix,
  findScenarioById,
} from "@empathy/domain-aerodynamics";

export const DEFAULT_AERO_REFERENCE_SPEED_KPH = 45;

export function buildAeroScenarioCompareFromProposal(
  proposal: AeroGeometryProposalV1,
  options?: { referenceSpeedKph?: number; maxCandidates?: number },
): AerodynamicsScenarioCompareV1 {
  return buildPositionScenarioMatrix({
    baselinePosition: proposal.position,
    baselineEquipment: proposal.equipment,
    geometry: proposal.geometry,
    cdaSurrogateM2: proposal.cdaSurrogateM2,
    confidence01: proposal.confidence01,
    referenceSpeedKph: options?.referenceSpeedKph ?? DEFAULT_AERO_REFERENCE_SPEED_KPH,
    maxCandidates: options?.maxCandidates,
  });
}

export { findScenarioById };
