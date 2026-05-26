import {
  DEFAULT_MECHANICAL_EFFICIENCY,
  mechanicalKjFromAvgPower,
  mechanicalKjFromIntensitySegments,
  mechanicalKjFromSegments,
  metabolicKcalFromMechanicalKj,
} from "@empathy/domain-physiology";
import { pro2BuilderContractToExpandedChartSegments } from "@/lib/training/builder/pro2-contract-chart-segments";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { expandContractToLadderSteps } from "@/lib/training/builder/pro2-structured-interval-ladder";
import { resolveAthleteFtpWattsForSessionEnergy } from "@/lib/training/physiology/resolve-athlete-ftp-watts";

export type SessionEnergyComputeContext = {
  /** FTP da memoria fisiologica atleta attivo (prioritaria). */
  athleteFtpWatts?: number | null;
  efficiency?: number;
};

function contractWithFtp(contract: Pro2BuilderSessionContract, ftpW: number): Pro2BuilderSessionContract {
  const rp = contract.renderProfile;
  return {
    ...contract,
    renderProfile: {
      intensityUnit: rp?.intensityUnit ?? "watt",
      ftpW,
      hrMax: rp?.hrMax ?? 185,
      lengthMode: rp?.lengthMode ?? "time",
      speedRefKmh: rp?.speedRefKmh ?? 35,
    },
  };
}

/**
 * Lavoro meccanico (kJ) da contratto builder con **FTP atleta attivo**.
 * Riespande ladder/segmenti con FTP risolta — non usa power pre-calcolate a 250 W.
 */
export function mechanicalKjFromPro2BuilderContract(
  contract: Pro2BuilderSessionContract | null | undefined,
  ctx?: SessionEnergyComputeContext,
): number {
  if (!contract) return 0;

  const ftpW = resolveAthleteFtpWattsForSessionEnergy({
    athleteFtpWatts: ctx?.athleteFtpWatts,
    contract,
  });

  if (ftpW != null && (contract.blocks?.length ?? 0) > 0) {
    const scaled = contractWithFtp(contract, ftpW);
    const steps = expandContractToLadderSteps(scaled);
    if (steps.length > 0) {
      return mechanicalKjFromSegments(
        steps.map((s) => ({ powerW: s.powerAvgW, durationSeconds: s.durationSec })),
      );
    }
    const segs = pro2BuilderContractToExpandedChartSegments(scaled);
    if (segs.length > 0) {
      return mechanicalKjFromIntensitySegments(
        segs.map((s) => ({ durationSeconds: s.durationSeconds, intensityLabel: s.intensityLabel })),
        ftpW,
      );
    }
  }

  const summary = contract.summary;
  if (typeof summary?.kj === "number" && summary.kj > 0) return Math.round(summary.kj);
  return mechanicalKjFromAvgPower(summary?.avgPowerW ?? 0, summary?.durationSec ?? 0);
}

/** kcal = (kJ_mech / η) / 4.184 — calendario + meal plan + fueling. */
export function metabolicKcalFromPro2BuilderContract(
  contract: Pro2BuilderSessionContract | null | undefined,
  ctx?: SessionEnergyComputeContext,
): number {
  const kj = mechanicalKjFromPro2BuilderContract(contract, ctx);
  return metabolicKcalFromMechanicalKj(kj, ctx?.efficiency ?? DEFAULT_MECHANICAL_EFFICIENCY);
}

export function metabolicKcalFromPro2SessionSummary(
  summary: Pro2BuilderSessionContract["summary"] | null | undefined,
): number {
  if (!summary) return 0;
  const kj =
    typeof summary.kj === "number" && summary.kj > 0
      ? summary.kj
      : mechanicalKjFromAvgPower(summary.avgPowerW, summary.durationSec);
  return metabolicKcalFromMechanicalKj(kj);
}

export function effectiveMetabolicKcalForPlannedContract(input: {
  contract: Pro2BuilderSessionContract | null;
  kcalTargetDb?: number | null;
  athleteFtpWatts?: number | null;
}): number | null {
  if (input.contract && (input.contract.blocks?.length ?? 0) > 0) {
    const fromMechanical = metabolicKcalFromPro2BuilderContract(input.contract, {
      athleteFtpWatts: input.athleteFtpWatts,
    });
    if (fromMechanical > 0) return fromMechanical;
  } else if (input.contract?.summary) {
    const fromSummary = metabolicKcalFromPro2SessionSummary(input.contract.summary);
    if (fromSummary > 0) return fromSummary;
  }

  const db =
    typeof input.kcalTargetDb === "number" && Number.isFinite(input.kcalTargetDb)
      ? Math.max(0, Math.round(input.kcalTargetDb))
      : 0;
  if (db > 0) return db;

  return null;
}
