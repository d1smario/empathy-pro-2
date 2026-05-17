/** Metriche carico Empathy V2 — nomenclatura non TrainingPeaks. Vedi `docs/EMPATHY_LOAD_METRICS_V2_SPEC.md`. */

export const EMPATHY_LOAD_METRICS_V2_METHOD = "EMPATHY_LOAD_V2_2026_05" as const;

export type EmpathyLoadMetricsV2MethodVersion = typeof EMPATHY_LOAD_METRICS_V2_METHOD;

export type EmpathyDailyLoadPointV2 = {
  date: string;
  methodVersion: EmpathyLoadMetricsV2MethodVersion;
  trainingLoadDaily: number;
  strain: number;
  fitness4: number;
  fitness8: number;
  form: number;
  stressCore: number;
  fatigueInt: number;
  conditioningInt4: number;
  conditioningInt8: number;
  formInt: number;
};

/** Etichette UI prodotto (IT). */
export const EMPATHY_LOAD_LABELS_IT = {
  trainingLoad: "Carico di lavoro",
  strain: "Fatica",
  fitness4: "Fitness · 4 settimane",
  fitness8: "Fitness · 8 settimane",
  form: "Forma",
  stressCore: "Stress core",
  fatigueInt: "Fatica int.",
  conditioningInt4: "Conditioning int. · 4w",
  conditioningInt8: "Conditioning int. · 8w",
  formInt: "Forma int.",
} as const;
