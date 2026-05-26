import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import {
  effectiveDurationMinutesFromPro2Contract,
  effectiveTssDisplayFromPro2Contract,
} from "@/lib/training/builder/pro2-session-notes";
import {
  effectiveMetabolicKcalForPlannedContract,
  mechanicalKjFromPro2BuilderContract,
} from "@/lib/training/physiology/session-metabolic-kcal";

export type PlannedSessionMetrics = {
  durationMinutes: number;
  tss: number;
  kj: number;
  kcal: number;
  avgPowerW: number | null;
};

export function resolvePlannedSessionMetrics(input: {
  contract?: Pro2BuilderSessionContract | null;
  durationMinutesDb?: number | null;
  tssTargetDb?: number | null;
  kcalTargetDb?: number | null;
  kjTargetDb?: number | null;
  athleteFtpWatts?: number | null;
}): PlannedSessionMetrics {
  const contract = input.contract ?? null;
  const durationMinutes = effectiveDurationMinutesFromPro2Contract(
    contract,
    Number(input.durationMinutesDb) || 0,
  );
  const tss = effectiveTssDisplayFromPro2Contract(contract, Number(input.tssTargetDb) || 0);

  const kjFromMechanical = mechanicalKjFromPro2BuilderContract(contract, {
    athleteFtpWatts: input.athleteFtpWatts,
  });
  const kjDb = Number(input.kjTargetDb);
  const kj =
    kjFromMechanical > 0
      ? kjFromMechanical
      : Number.isFinite(kjDb) && kjDb > 0
        ? Math.round(kjDb)
        : contract?.summary?.kj != null && contract.summary.kj > 0
          ? Math.round(contract.summary.kj)
          : 0;

  const kcalResolved = effectiveMetabolicKcalForPlannedContract({
    contract,
    kcalTargetDb: input.kcalTargetDb,
    athleteFtpWatts: input.athleteFtpWatts,
  });
  const kcal = kcalResolved != null && kcalResolved > 0 ? kcalResolved : 0;

  const durationSec = durationMinutes * 60;
  const avgFromSummary = contract?.summary?.avgPowerW;
  const avgPowerW =
    typeof avgFromSummary === "number" && avgFromSummary > 0
      ? Math.round(avgFromSummary)
      : durationSec > 0 && kj > 0
        ? Math.round((kj * 1000) / durationSec)
        : null;

  return { durationMinutes, tss, kj, kcal, avgPowerW };
}
