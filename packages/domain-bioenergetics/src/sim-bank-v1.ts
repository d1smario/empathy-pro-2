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
  /** Ampiezza onda diurna (8–21h) in `glucoseCircadianSleepDayEnvelopeMmol`; notte gestita a parte. */
  circAmp: 0.46,
  /** @deprecated per glucosio (resta nei tipi per compatibilità lettura banca); fase non più usata nel sim sub-orario. */
  circPhaseHour: 4,
  /** Moltiplicatore su impulso pasto (CHO+IG): enfatizza fattore nutrizionale sulla curva. */
  mealBumpMmol: 0.58,
  /** Riduzione glucosio sotto sforzo (muscolo): più visibile con allenamenti lunghi. */
  activityDipMmol: 0.16,
  clampLo: 3.9,
  clampHi: 9.8,
} as const;

export const SIM_DIURNAL_LACTATE_V1 = {
  baseMmol: 1.02,
  oxidationLinear: 0.007,
  stressLinear: 0.15,
  circAmp: 0.16,
  circPhaseHour: 15,
  activityBumpMmol: 0.78,
  oxidationActivityK: 0.0055,
  mealDipMmol: 0.055,
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

/**
 * Modulazione diurna cortisolo / ACTH da carico prandiale (roadmap 2.2).
 * Bump pomeridiano sul cortisolo + leggero anticipo picco ACTH; coefficienti revisionabili qui.
 */
export const SIM_CORTISOL_MEAL_MOD_V1 = {
  /** Incremento massimo µg/dL (h≈15) quando `postprandialMealLoad01` = 1 */
  afternoonCortisolMaxUgdL: 1.68,
  /** Anticipo massimo centro gaussiano ACTH (ore) quando mealLoad01 = 1 */
  acthPeakAdvanceHoursMax: 0.32,
} as const;
