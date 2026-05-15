export type AdaptationScoreMethodVersion = "adaptation_score_v1";

/**
 * Score adattamento versionato Empathy (non equivalenza con metriche vendor).
 * Numeri deterministici da twin + internal-load; `confidence` riflette copertura sorgenti.
 */
export type AdaptationScoreV1 = {
  methodVersion: AdaptationScoreMethodVersion;
  /** 0–1: copertura dati (eseguito, pianificato, recovery device, fisiologia). */
  confidence: number;
  /** 0–100: composito Empathy (stesso ordine di grandezza del campo legacy `adaptationScore` sul twin). */
  compositeScore: number;
  readinessBalance01: number;
  externalAcuteNorm: number;
  internalRecoveryNorm: number;
  divergence01: number;
  drivers: string[];
};

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
