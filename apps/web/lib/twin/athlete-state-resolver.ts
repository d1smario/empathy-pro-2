import { createServerSupabaseClient } from "@/lib/supabase-server";
import { resolveCanonicalPhysiologyState, type CanonicalPhysiologyState } from "@/lib/physiology/profile-resolver";
import type { TwinState } from "@/lib/empathy/schemas";
import { computeDailyLoadSeries, type ExecutedWorkoutLoadRow } from "@/lib/training/analytics/load-series";
import { extractSignalFromDeviceExportRow } from "@/lib/reality/sleep-recovery-signals";
import { resolveInternalLoadState } from "@/lib/internal-load/internal-load-resolver";

type PlannedWorkoutRow = {
  date: string | null;
  tss_target: number | null;
  duration_minutes: number | null;
};

export type CanonicalTwinState = TwinState & {
  sources: {
    physiology: boolean;
    bioenergetics: boolean;
    executedLoad: boolean;
    plannedLoad: boolean;
    realityRecovery: boolean;
    internalLoad: boolean;
  };
  loadSnapshot: {
    recentExecutedSessions: number;
    plannedSessionsNext7d: number;
    plannedTssNext7d: number;
    lastExternalLoad: number;
    lastInternalLoad: number;
  };
};

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateIso;
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function resolveFuelAvailabilityScore(physiologyState: CanonicalPhysiologyState) {
  const lactate = physiologyState.lactateProfile;
  const glycogenCombustedNetG =
    lactate.glycogenCombustedNetG ?? asNum(lactate.latestValues?.glycogenCombustedNetG) ?? null;
  const glucoseRequiredForStrategyG =
    lactate.glucoseRequiredForStrategyG ?? asNum(lactate.latestValues?.glucoseRequiredForStrategyG) ?? null;
  const choIntoBloodstreamG =
    lactate.choIntoBloodstreamG ?? asNum(lactate.latestValues?.choIntoBloodstreamG) ?? null;
  const exogenousOxidizedG =
    lactate.exogenousOxidizedG ?? asNum(lactate.latestValues?.exogenousOxidizedG) ?? null;
  const bloodDeliveryPct =
    lactate.bloodDeliveryPctOfIngested ?? asNum(lactate.latestValues?.bloodDeliveryPctOfIngested) ?? null;

  const glycogenDrainScore =
    glycogenCombustedNetG != null ? clamp(100 - glycogenCombustedNetG * 0.75, 8, 100) : null;
  const strategyDemandScore =
    glucoseRequiredForStrategyG != null ? clamp(100 - glucoseRequiredForStrategyG * 0.55, 12, 100) : null;
  const bloodstreamSupportScore =
    choIntoBloodstreamG != null || exogenousOxidizedG != null
      ? clamp(20 + (choIntoBloodstreamG ?? 0) * 0.9 + (exogenousOxidizedG ?? 0) * 1.1, 0, 100)
      : null;
  const deliveryScore = bloodDeliveryPct != null ? clamp(bloodDeliveryPct, 0, 100) : null;
  const strategyCoverageScore =
    glucoseRequiredForStrategyG != null
      ? clamp((((choIntoBloodstreamG ?? 0) + (exogenousOxidizedG ?? 0)) / Math.max(1, glucoseRequiredForStrategyG)) * 100, 0, 100)
      : null;

  return average([
    average([glycogenDrainScore, strategyDemandScore]),
    bloodstreamSupportScore,
    average([deliveryScore, strategyCoverageScore]),
  ]);
}

export async function resolveCanonicalTwinState(
  athleteId: string,
  physiologyOverride?: CanonicalPhysiologyState,
): Promise<CanonicalTwinState> {
  const supabase = createServerSupabaseClient();
  const today = toDateOnly(new Date());
  const executedFrom = addDays(today, -42);
  const plannedTo = addDays(today, 8);
  const recoveryFrom = addDays(today, -7);

  const [physiologyState, executedRes, plannedRes, recoveryExportsRes] = await Promise.all([
    physiologyOverride ?? resolveCanonicalPhysiologyState(athleteId),
    supabase
      .from("executed_workouts")
      .select("date, tss, duration_minutes, trace_summary, lactate_mmoll, glucose_mmol, smo2")
      .eq("athlete_id", athleteId)
      .gte("date", executedFrom)
      .lte("date", today)
      .order("date", { ascending: true }),
    supabase
      .from("planned_workouts")
      .select("date, tss_target, duration_minutes")
      .eq("athlete_id", athleteId)
      .gte("date", today)
      .lt("date", plannedTo)
      .order("date", { ascending: true }),
    supabase
      .from("device_sync_exports")
      .select("provider, payload, created_at")
      .eq("athlete_id", athleteId)
      .gte("created_at", `${recoveryFrom}T00:00:00.000Z`)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (executedRes.error) throw new Error(executedRes.error.message);
  if (plannedRes.error) throw new Error(plannedRes.error.message);
  if (recoveryExportsRes.error) throw new Error(recoveryExportsRes.error.message);

  const executedRows = (executedRes.data ?? []) as ExecutedWorkoutLoadRow[];
  const plannedRows = (plannedRes.data ?? []) as PlannedWorkoutRow[];
  const recoveryRows = ((recoveryExportsRes.data ?? []) as Array<Record<string, unknown>>).filter((row) => {
    const signal = extractSignalFromDeviceExportRow(row);
    return (
      signal.sleepScore != null ||
      signal.readinessScore != null ||
      signal.recoveryScore != null ||
      signal.hrvMs != null ||
      signal.sleepDurationHours != null
    );
  });
  const latestRecoverySignal = recoveryRows.length > 0 ? extractSignalFromDeviceExportRow(recoveryRows[0]) : null;
  const internalLoadState = await resolveInternalLoadState({
    athleteId,
    physiologyState,
    executedRows,
    plannedRows,
  });
  const series = computeDailyLoadSeries(executedRows);
  const latest = series.at(-1);
  const plannedTssNext7d = plannedRows.reduce((sum, row) => sum + Math.max(0, Number(row.tss_target ?? 0)), 0);
  const plannedSessionsNext7d = plannedRows.length;
  const physiologyFuelAvailability = resolveFuelAvailabilityScore(physiologyState);
  const readinessBase = latest ? 62 + latest.tsb * 0.9 + latest.iTsb * 0.18 : 60;
  const hrvBoost = physiologyState.recoveryProfile.baselineHrvMs ? (physiologyState.recoveryProfile.baselineHrvMs - 55) * 0.18 : 0;
  const recoveryHrvBoost =
    latestRecoverySignal?.hrvMs != null && physiologyState.recoveryProfile.baselineHrvMs
      ? (latestRecoverySignal.hrvMs - physiologyState.recoveryProfile.baselineHrvMs) * 0.22
      : 0;
  const inflammationPenalty = (physiologyState.bioenergeticProfile.inflammationProxy ?? 0) * 0.22;
  const hydrationPenalty =
    physiologyState.bioenergeticProfile.hydrationStatus == null
      ? 0
      : Math.max(0, 55 - physiologyState.bioenergeticProfile.hydrationStatus) * 0.45;
  const fatigueScore = latest ? clamp(latest.atl * 1.15 + latest.iAtl * 0.18, 0, 100) : 35;
  const sleepRecoverySignal = clamp(
    latestRecoverySignal?.sleepScore ??
      latestRecoverySignal?.readinessScore ??
      latestRecoverySignal?.recoveryScore ??
      0,
    0,
    100,
  );
  const sleepDurationBonus =
    latestRecoverySignal?.sleepDurationHours != null
      ? clamp((latestRecoverySignal.sleepDurationHours - 7) * 4, -10, 8)
      : 0;
  const strainPenalty = (latestRecoverySignal?.strainScore ?? 0) * 0.08;
  const rawReadiness = clamp(
    readinessBase +
      hrvBoost +
      recoveryHrvBoost +
      (sleepRecoverySignal > 0 ? (sleepRecoverySignal - 70) * 0.28 : 0) +
      sleepDurationBonus -
      inflammationPenalty -
      hydrationPenalty -
      strainPenalty,
    0,
    100,
  );
  const readiness = clamp(rawReadiness * 0.55 + internalLoadState.adaptationReadiness * 0.45, 0, 100);
  const operationalFuelPressure = clamp(82 - (latest?.external ?? 0) * 0.15 - plannedTssNext7d * 0.035, 5, 100);
  const glycogenStatus = clamp(
    physiologyFuelAvailability != null
      ? operationalFuelPressure * 0.45 + physiologyFuelAvailability * 0.55
      : operationalFuelPressure,
    5,
    100,
  );
  const autonomicStrain = clamp(100 - readiness + fatigueScore * 0.22, 0, 100);
  const glycolyticStrain = clamp(
    physiologyState.lactateProfile.glycolyticSharePct ??
      asNum(physiologyState.lactateProfile.latestValues?.glycolyticSharePct) ??
      0,
    0,
    100,
  );
  const oxidativeBottleneck = clamp(
    100 -
      ((physiologyState.performanceProfile.peripheralUtilizationIndex ??
        asNum(physiologyState.performanceProfile.latestValues?.peripheralUtilizationIndex) ??
        1) *
        100),
    0,
    100,
  );
  const redoxStressIndex = clamp(
    physiologyState.performanceProfile.redoxStressIndex ??
      asNum(physiologyState.performanceProfile.latestValues?.redoxStressIndex) ??
      physiologyState.bioenergeticProfile.inflammationProxy ??
      0,
    0,
    100,
  );
  const giTolerance = clamp(
    100 -
      ((physiologyState.lactateProfile.effectiveSequestrationPct ??
        asNum(physiologyState.lactateProfile.latestValues?.effectiveSequestrationPct) ??
        0) *
        4.5),
    0,
    100,
  );
  const inflammationRisk = clamp(
    physiologyState.bioenergeticProfile.inflammationProxy ?? redoxStressIndex,
    0,
    100,
  );
  const adaptationScore = clamp(
    readiness * 0.45 +
      (100 - fatigueScore) * 0.25 +
      (100 - redoxStressIndex) * 0.15 +
      glycogenStatus * 0.15,
    0,
    100,
  );

  return {
    athleteId,
    asOf: new Date().toISOString(),
    fitnessChronic: latest ? Number(latest.ctl.toFixed(1)) : 0,
    fatigueAcute: latest ? Number(latest.atl.toFixed(1)) : 0,
    readiness: Number(readiness.toFixed(1)),
    recoveryDebt: Number(clamp(fatigueScore - readiness, 0, 100).toFixed(1)),
    glycogenStatus: Number(glycogenStatus.toFixed(1)),
    autonomicStrain: Number(autonomicStrain.toFixed(1)),
    glycolyticStrain: Number(glycolyticStrain.toFixed(1)),
    oxidativeBottleneck: Number(oxidativeBottleneck.toFixed(1)),
    redoxStressIndex: Number(redoxStressIndex.toFixed(1)),
    thermalStress: nullishToNumber(physiologyState.performanceProfile.latestValues?.thermalStrainIndex),
    sleepRecovery:
      latestRecoverySignal?.sleepScore != null
        ? Number(clamp(latestRecoverySignal.sleepScore, 0, 100).toFixed(1))
        : latestRecoverySignal?.recoveryScore != null
          ? Number(clamp(latestRecoverySignal.recoveryScore, 0, 100).toFixed(1))
          : physiologyState.recoveryProfile.baselineHrvMs
            ? Number(clamp(physiologyState.recoveryProfile.baselineHrvMs * 1.1, 0, 100).toFixed(1))
            : undefined,
    internalLoadIndex: Number(internalLoadState.internalLoadIndex.toFixed(1)),
    recoveryCapacity: Number(internalLoadState.recoveryCapacity.toFixed(1)),
    adaptationReadiness: Number(internalLoadState.adaptationReadiness.toFixed(1)),
    giTolerance: Number(giTolerance.toFixed(1)),
    inflammationRisk: Number(inflammationRisk.toFixed(1)),
    adaptationScore: Number(((adaptationScore * 0.55) + (internalLoadState.observed.observedAdaptationScore * 0.45)).toFixed(1)),
    expectedAdaptation: Number(internalLoadState.expected.expectedAdaptationScore.toFixed(1)),
    realAdaptation: Number(internalLoadState.observed.observedAdaptationScore.toFixed(1)),
    divergenceScore: Number(internalLoadState.divergence.divergenceScore.toFixed(1)),
    likelyDrivers: internalLoadState.divergence.likelyDrivers,
    interventionScore: Number(clamp((100 - readiness) * 0.55 + inflammationRisk * 0.2, 0, 100).toFixed(1)),
    sources: {
      physiology:
        physiologyState.sources.physiologicalProfile ||
        physiologyState.sources.lactateRun ||
        physiologyState.sources.performanceRun,
      bioenergetics:
        physiologyState.sources.biomarkerPanel ||
        physiologyState.sources.lactateRun ||
        physiologyState.sources.performanceRun,
      executedLoad: executedRows.length > 0,
      plannedLoad: plannedRows.length > 0,
      realityRecovery: recoveryRows.length > 0,
      internalLoad: true,
    },
    loadSnapshot: {
      recentExecutedSessions: executedRows.length,
      plannedSessionsNext7d,
      plannedTssNext7d: Math.round(plannedTssNext7d),
      lastExternalLoad: latest ? Number(latest.external.toFixed(1)) : 0,
      lastInternalLoad: latest ? Number(latest.internal.toFixed(1)) : 0,
    },
  };
}

function nullishToNumber(value: unknown): number | undefined {
  const n = asNum(value);
  return n == null ? undefined : Number(clamp(n, 0, 100).toFixed(1));
}
