export type AdaptationTrafficLight = "green" | "yellow" | "red";

export type AdaptationGuidance = {
  scorePct: number;
  trafficLight: AdaptationTrafficLight;
  expectedAdaptation: number;
  observedAdaptation: number;
  reductionMinPct: number;
  reductionMaxPct: number;
  keepProgramUnchanged: boolean;
  guidance: string;
  likelyDrivers: string[];
};
