export type ActivityState = "rest" | "easy" | "tempo" | "high_intensity";

export type EvidenceProfileV1 = {
  id: string;
  version: "v1";
  summary: string;
  references: string[];
  defaultBaselineGlucoseMmol: number;
  perGramGlucoseExcursionMmol: number;
  perGramInsulinDemand: number;
  perGramHpaDrive: number;
  baseBandPct: number;
  gutStressExcursionFactor: number;
  activityStates: Record<
    ActivityState,
    {
      glucoseExcursionMultiplier: number;
      insulinDemandMultiplier: number;
      hpaDriveMultiplier: number;
      insulinDemandBase: number;
      hpaDriveBase: number;
    }
  >;
};

/**
 * Curated deterministic profile.
 * References are traceable literature anchors; coefficients are conservative proxies, not clinical diagnostics.
 */
export const EVIDENCE_PROFILE_V1: EvidenceProfileV1 = {
  id: "acute_surrogate_v1_curated_2026_05",
  version: "v1",
  summary: "Proxy glucose/insulin/HPA response per CHO and activity context.",
  references: [
    "Colberg et al., Exercise and type 2 diabetes position statement, Diabetes Care 2016",
    "Romijn et al., Regulation of endogenous fat and carbohydrate metabolism in relation to exercise intensity, AJP 1993",
    "Ivy et al., Muscle glycogen synthesis after exercise, J Appl Physiol 1988",
    "Rasmussen et al., Cortisol and ACTH responses to exercise intensity, J Clin Endocrinol Metab 2001",
  ],
  defaultBaselineGlucoseMmol: 5.4,
  perGramGlucoseExcursionMmol: 0.04,
  perGramInsulinDemand: 0.0045,
  perGramHpaDrive: 0.0018,
  baseBandPct: 0.18,
  gutStressExcursionFactor: 0.22,
  activityStates: {
    rest: {
      glucoseExcursionMultiplier: 1.18,
      insulinDemandMultiplier: 1.2,
      hpaDriveMultiplier: 0.92,
      insulinDemandBase: 0.32,
      hpaDriveBase: 0.36,
    },
    easy: {
      glucoseExcursionMultiplier: 0.82,
      insulinDemandMultiplier: 0.75,
      hpaDriveMultiplier: 1.05,
      insulinDemandBase: 0.28,
      hpaDriveBase: 0.44,
    },
    tempo: {
      glucoseExcursionMultiplier: 0.7,
      insulinDemandMultiplier: 0.58,
      hpaDriveMultiplier: 1.24,
      insulinDemandBase: 0.27,
      hpaDriveBase: 0.5,
    },
    high_intensity: {
      glucoseExcursionMultiplier: 0.63,
      insulinDemandMultiplier: 0.44,
      hpaDriveMultiplier: 1.42,
      insulinDemandBase: 0.26,
      hpaDriveBase: 0.58,
    },
  },
};
