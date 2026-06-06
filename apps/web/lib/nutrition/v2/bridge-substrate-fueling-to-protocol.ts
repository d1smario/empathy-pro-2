import type { SubstrateFuelingPlanV2 } from "@empathy/contracts";
import { buildFuelingProtocolSlots } from "@/lib/nutrition/fueling-session-protocol";

export type SubstrateFuelingProtocolMeta = {
  preChoG: number;
  intraChoG: number;
  postChoG: number;
  fuelingKcal: number;
  protocolSlots: ReturnType<typeof buildFuelingProtocolSlots>;
};

export function bridgeSubstrateFuelingToProtocolMeta(input: {
  substrateFueling: SubstrateFuelingPlanV2;
  durationMin: number;
  preferredBrands?: string[];
  fluidMlPerHour?: number;
}): SubstrateFuelingProtocolMeta {
  const session = input.substrateFueling.sessions[0];
  const preCho = session?.preChoG ?? input.substrateFueling.totals.preChoG;
  const intraCho = session?.intraChoG ?? input.substrateFueling.totals.intraChoG;
  const postCho = session?.postChoG ?? input.substrateFueling.totals.postChoG;

  const protocolSlots = buildFuelingProtocolSlots({
    durationMin: input.durationMin,
    preCho,
    postCho,
    intraTotalCho: intraCho,
    effectiveFluidMlPerHour: input.fluidMlPerHour ?? 600,
    resolvedFuelingTierBand: (session?.intraChoGPerH ?? 0) >= 90 ? "high" : "base",
    engineSuffix: " · fueling V2 substrati",
    intraSplitNote: "",
    profileSupplements: input.preferredBrands ?? [],
    preferredBrands: input.preferredBrands ?? [],
  });

  return {
    preChoG: preCho,
    intraChoG: intraCho,
    postChoG: postCho,
    fuelingKcal: input.substrateFueling.totals.fuelingKcal,
    protocolSlots,
  };
}
