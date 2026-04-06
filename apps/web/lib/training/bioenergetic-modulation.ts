import type { PhysiologyState } from "@/lib/empathy/schemas/physiology";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";
import type { TwinState } from "@/lib/empathy/schemas/twin";
import { summarizeSignalPresence } from "@/lib/data-sufficiency/coverage";

export type BioenergeticModulation = {
  loadScale: number;
  loadScalePct: number;
  state: "supported" | "watch" | "protective";
  mitochondrialReadinessScore: number;
  signalCoveragePct: number;
  inputUncertaintyPct: number;
  missingSignals: string[];
  recommendedInputs: string[];
  cellularHydrationScore: number | null;
  autonomicRecoveryScore: number | null;
  inflammatoryStressScore: number | null;
  fuelAvailabilityScore: number | null;
  phaseAngleNormalized: number | null;
  signalCoverage: string[];
  headline: string;
  guidance: string;
  evidenceTier: "proxy_supported";
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function normalizePercentLike(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= 12) return clamp(((value - 3) / 6) * 100, 0, 100);
  return clamp(value, 0, 100);
}

function normalizePhaseAngle(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= 12) return clamp(((value - 3.5) / 4.5) * 100, 0, 100);
  return clamp(value, 0, 100);
}

function invertScore(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return clamp(100 - value, 0, 100);
}

function normalizeHrvAgainstBaseline(current: number | null | undefined, baseline: number | null | undefined) {
  if (current == null || baseline == null || !Number.isFinite(current) || !Number.isFinite(baseline) || baseline <= 0) {
    return current != null ? clamp((current / 120) * 100, 0, 100) : null;
  }
  const ratio = current / baseline;
  return clamp(50 + (ratio - 1) * 180, 0, 100);
}

function normalizeRestingHrAgainstBaseline(current: number | null | undefined, baseline: number | null | undefined) {
  if (current == null || !Number.isFinite(current)) return null;
  if (baseline == null || !Number.isFinite(baseline) || baseline <= 0) {
    return clamp(100 - Math.max(0, current - 48) * 2.5, 0, 100);
  }
  const delta = current - baseline;
  return clamp(100 - Math.max(0, delta) * 7, 0, 100);
}

export function buildBioenergeticModulation(input: {
  physiologyState: PhysiologyState;
  twinState: TwinState;
  recoverySummary: RecoverySummary | null;
}): BioenergeticModulation {
  const { physiologyState, twinState, recoverySummary } = input;
  const bio = physiologyState.bioenergeticProfile;
  const recovery = physiologyState.recoveryProfile;

  const phaseAngleNormalized = normalizePhaseAngle(bio.phaseAngleScore);
  const hydrationScore = normalizePercentLike(bio.hydrationStatus);
  const cellIntegrityScore = normalizePercentLike(bio.cellIntegrity);
  const mitochondrialEfficiencyScore = normalizePercentLike(bio.mitochondrialEfficiency);
  const inflammationInverse = invertScore(normalizePercentLike(bio.inflammationProxy));
  const redoxInverse = invertScore(normalizePercentLike(twinState.redoxStressIndex));
  const inflammationRiskInverse = invertScore(normalizePercentLike(twinState.inflammationRisk));
  const hrvReserveScore = normalizeHrvAgainstBaseline(recoverySummary?.hrvMs, recovery.baselineHrvMs);
  const restingHrScore = normalizeRestingHrAgainstBaseline(recoverySummary?.restingHrBpm, recovery.restingHrBpm);
  const readinessScore =
    twinState.readiness != null && Number.isFinite(twinState.readiness) ? clamp(twinState.readiness, 0, 100) : null;
  const glycogenScore =
    twinState.glycogenStatus != null && Number.isFinite(twinState.glycogenStatus)
      ? clamp(twinState.glycogenStatus, 0, 100)
      : null;
  const signalSummary = summarizeSignalPresence([
    { key: "phase_angle", present: phaseAngleNormalized != null, recommendedInput: "bioimpedance_phase_angle" },
    { key: "hydration_status", present: hydrationScore != null, recommendedInput: "bioimpedance_fluid_distribution" },
    { key: "cell_integrity", present: cellIntegrityScore != null, recommendedInput: "bioimpedance_reactance" },
    {
      key: "mitochondrial_efficiency",
      present: mitochondrialEfficiencyScore != null,
      recommendedInput: "max_oxidate_or_bioenergetic_panel",
    },
    { key: "hrv", present: hrvReserveScore != null, recommendedInput: "night_hrv" },
    { key: "resting_hr", present: restingHrScore != null, recommendedInput: "resting_hr" },
    { key: "inflammation_redox", present: inflammationInverse != null || redoxInverse != null, recommendedInput: "blood_redox_inflammation_panel" },
    { key: "glycogen", present: glycogenScore != null, recommendedInput: "twin_glycogen_or_nutrition_state" },
  ]);

  const cellularHydrationScore = average([phaseAngleNormalized, hydrationScore, cellIntegrityScore]);
  const autonomicRecoveryScore = average([hrvReserveScore, restingHrScore, recoverySummary?.readinessScore ?? readinessScore]);
  const inflammatoryStressScore = average([inflammationInverse, redoxInverse, inflammationRiskInverse]);
  const fuelAvailabilityScore = average([glycogenScore, readinessScore]);
  const mitochondrialReadinessScore = round(
    average([
      average([mitochondrialEfficiencyScore, redoxInverse]),
      cellularHydrationScore,
      autonomicRecoveryScore,
      inflammatoryStressScore,
      fuelAvailabilityScore,
    ]) ?? 65,
    1,
  );

  let rawLoadScale = 1;
  let state: BioenergeticModulation["state"] = "supported";
  if (mitochondrialReadinessScore < 45) {
    rawLoadScale = 0.78;
    state = "protective";
  } else if (mitochondrialReadinessScore < 60) {
    rawLoadScale = 0.88;
    state = "watch";
  } else if (mitochondrialReadinessScore < 72) {
    rawLoadScale = 0.94;
    state = "watch";
  }

  if ((cellularHydrationScore ?? 100) < 42) {
    rawLoadScale = Math.min(rawLoadScale, 0.84);
    state = "protective";
  }
  if ((inflammatoryStressScore ?? 100) < 40) {
    rawLoadScale = Math.min(rawLoadScale, 0.82);
    state = "protective";
  }
  if ((fuelAvailabilityScore ?? 100) < 35) {
    rawLoadScale = Math.min(rawLoadScale, 0.86);
    state = "protective";
  }

  const certaintyWeight = clamp(signalSummary.coveragePct / 100, 0.35, 1);
  const loadScale = round(clamp(1 - (1 - rawLoadScale) * certaintyWeight, 0.72, 1), 2);
  const loadScalePct = Math.round(loadScale * 100);

  const signalCoverage = [
    phaseAngleNormalized != null ? "phase_angle" : null,
    hydrationScore != null ? "hydration" : null,
    cellIntegrityScore != null ? "cell_integrity" : null,
    mitochondrialEfficiencyScore != null ? "mitochondrial_efficiency" : null,
    hrvReserveScore != null ? "hrv" : null,
    restingHrScore != null ? "resting_hr" : null,
    inflammationInverse != null || redoxInverse != null ? "inflammation_redox" : null,
    glycogenScore != null ? "glycogen" : null,
  ].filter((item): item is string => Boolean(item));

  const parts: string[] = [];
  if ((cellularHydrationScore ?? 100) < 50) {
    parts.push("Segnali cellulari/idratazione deboli: phase angle, idratazione o integrita' di membrana non sostengono una giornata aggressiva.");
  }
  if ((autonomicRecoveryScore ?? 100) < 50) {
    parts.push("Asse autonomico in recupero incompleto: HRV/readiness/resting HR suggeriscono prudenza.");
  }
  if ((inflammatoryStressScore ?? 100) < 50) {
    parts.push("Carico redox/infiammatorio elevato: privilegia densita' controllata e minore aggressivita' metabolica.");
  }
  if ((fuelAvailabilityScore ?? 100) < 45) {
    parts.push("Disponibilita' substrati/twin limitata: proteggi glicogeno e tolleranza del sistema.");
  }
  if (!parts.length) {
    parts.push("Proxy bioenergetici coerenti con una seduta standard: modulazione mantenuta neutra.");
  }
  if (signalSummary.missingSignals.length) {
    parts.push(
      `Copertura segnali ${Math.round(signalSummary.coveragePct)}%: il modello resta operativo ma migliorerebbe con ${signalSummary.recommendedInputs.join(", ")}.`,
    );
  }
  if (signalSummary.inputUncertaintyPct >= 35 && loadScale > rawLoadScale) {
    parts.push("Influenza bioenergetica attenuata automaticamente per evitare overcorrezioni quando i dati sono incompleti.");
  }

  return {
    loadScale,
    loadScalePct,
    state,
    mitochondrialReadinessScore,
    signalCoveragePct: signalSummary.coveragePct,
    inputUncertaintyPct: signalSummary.inputUncertaintyPct,
    missingSignals: signalSummary.missingSignals,
    recommendedInputs: signalSummary.recommendedInputs,
    cellularHydrationScore: cellularHydrationScore != null ? round(cellularHydrationScore, 1) : null,
    autonomicRecoveryScore: autonomicRecoveryScore != null ? round(autonomicRecoveryScore, 1) : null,
    inflammatoryStressScore: inflammatoryStressScore != null ? round(inflammatoryStressScore, 1) : null,
    fuelAvailabilityScore: fuelAvailabilityScore != null ? round(fuelAvailabilityScore, 1) : null,
    phaseAngleNormalized: phaseAngleNormalized != null ? round(phaseAngleNormalized, 1) : null,
    signalCoverage,
    headline:
      state === "protective"
        ? "Bioenergetic protective modulation"
        : state === "watch"
          ? "Bioenergetic watch modulation"
          : "Bioenergetic support modulation",
    guidance: `${parts.join(" ")} Proxy readiness bioenergetica stimata ~${round(mitochondrialReadinessScore, 0)} / 100.`,
    evidenceTier: "proxy_supported",
  };
}
