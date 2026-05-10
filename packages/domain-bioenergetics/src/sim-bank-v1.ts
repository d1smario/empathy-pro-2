/**
 * Banca coefficienti v1 — valori revisionabili / golden-test offline (non runtime web).
 * Contesto carico interno: Banister MSSE 1975 — DOI: 10.1249/00005768-197701000-00024
 */
export const SIM_BANK_VERSION = 1 as const;

/** Diurna glucosio / lattato (modulazione pasti + sedute via timeline in day-simulator-v1). */
export const SIM_DIURNAL_GLUCOSE_V1 = {
  baseMmol: 5.15,
  insulinLinear: 0.011,
  stressLinear: 0.25,
  circAmp: 0.38,
  circPhaseHour: 4,
  mealBumpMmol: 0.42,
  activityDipMmol: 0.1,
  clampLo: 3.9,
  clampHi: 9.8,
} as const;

export const SIM_DIURNAL_LACTATE_V1 = {
  baseMmol: 1.02,
  oxidationLinear: 0.007,
  stressLinear: 0.15,
  circAmp: 0.12,
  circPhaseHour: 15,
  activityBumpMmol: 0.55,
  oxidationActivityK: 0.004,
  mealDipMmol: 0.04,
  clampLo: 0.75,
  clampHi: 5.2,
} as const;

export const SIM_STRESS_V1 = {
  insulinWeight: 1,
  anabolicWeight: 1,
  glucoseHandlingDeficitWeight: 1,
  divisor: 300,
} as const;

export const SIM_PATHWAY_SCALE_V1 = {
  inhibitory: 1.08,
  supportive: 0.96,
  mixed: 1,
} as const;
