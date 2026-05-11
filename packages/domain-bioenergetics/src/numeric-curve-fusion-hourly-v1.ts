import type { BioenergeticChannelCurveResolutionV1 } from "@empathy/contracts";
import { BIOENERGETIC_CURVE_FUSION_CONTRACT_VERSION } from "@empathy/contracts";

/**
 * Merge numerico orario (0–23) tra serie deterministica / Empathy e proposta AI **già validata**.
 * Rispetta `curve-fusion-arbitration-v1`: con `measurement_wins` la proposta AI non modifica i valori.
 */
export function mergeHourlyBioenergeticCurvesV1(input: {
  deterministicHourly: readonly (number | null)[];
  aiHourly: readonly number[];
  resolution: BioenergeticChannelCurveResolutionV1;
}): { merged: (number | null)[]; appliedAiBlend: boolean } {
  if (input.resolution.fusionContractVersion !== BIOENERGETIC_CURVE_FUSION_CONTRACT_VERSION) {
    throw new Error("curve_fusion_contract_mismatch");
  }
  if (input.deterministicHourly.length !== 24 || input.aiHourly.length !== 24) {
    throw new Error("hourly_length_must_be_24");
  }

  if (input.resolution.governance === "measurement_wins") {
    return { merged: [...input.deterministicHourly], appliedAiBlend: false };
  }

  const d = input.resolution.deterministicWeight01;
  const a = input.resolution.aiProposalWeight01;
  const merged: (number | null)[] = [];
  for (let h = 0; h < 24; h += 1) {
    const det = input.deterministicHourly[h];
    const ai = input.aiHourly[h];
    if (det != null && Number.isFinite(det)) {
      merged.push(d * det + a * ai);
    } else {
      merged.push(ai);
    }
  }
  return { merged, appliedAiBlend: true };
}
