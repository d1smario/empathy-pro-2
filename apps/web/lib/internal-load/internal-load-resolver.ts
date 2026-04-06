import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  InternalLoadChannelState,
  InternalLoadSignal,
  InternalLoadState,
  PhysiologyState,
} from "@/lib/empathy/schemas";
import type { ExecutedWorkoutLoadRow } from "@/lib/training/analytics/load-series";
import { computeDailyLoadSeries } from "@/lib/training/analytics/load-series";
import { extractSignalFromDeviceExportRow } from "@/lib/reality/sleep-recovery-signals";
import { resolveCanonicalPhysiologyState } from "@/lib/physiology/profile-resolver";

type PlannedWorkoutRow = {
  date: string | null;
  tss_target: number | null;
  duration_minutes: number | null;
};

type ResolveInternalLoadStateInput = {
  athleteId: string;
  physiologyState?: PhysiologyState;
  executedRows?: ExecutedWorkoutLoadRow[];
  plannedRows?: PlannedWorkoutRow[];
};

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function scoreFromRelativeDeviation(
  current: number | null,
  baseline: number | null,
  opts: { preferredDirection: "higher" | "lower"; tolerancePct: number; maxPenaltyPct: number },
): { score: number; deviationPct: number | null } {
  if (current == null || baseline == null || baseline === 0) {
    return { score: 50, deviationPct: null };
  }
  const rawDeviationPct = ((current - baseline) / Math.abs(baseline)) * 100;
  const signedDeviation =
    opts.preferredDirection === "higher"
      ? rawDeviationPct
      : -rawDeviationPct;
  if (signedDeviation >= -opts.tolerancePct) {
    const upsideBonus = signedDeviation > 0 ? clamp(signedDeviation * 0.35, 0, 12) : 0;
    return {
      score: clamp(78 + upsideBonus, 0, 100),
      deviationPct: round(rawDeviationPct, 1),
    };
  }
  const harmfulPct = Math.abs(signedDeviation) - opts.tolerancePct;
  const penalty = clamp((harmfulPct / Math.max(1, opts.maxPenaltyPct)) * 45, 0, 60);
  return {
    score: clamp(78 - penalty, 0, 100),
    deviationPct: round(rawDeviationPct, 1),
  };
}

function buildSignal(input: {
  key: string;
  label: string;
  value: number | null;
  baseline: number | null;
  unit?: string;
  preferredDirection: "higher" | "lower";
  tolerancePct: number;
  maxPenaltyPct: number;
  source: string;
}): InternalLoadSignal {
  const score = scoreFromRelativeDeviation(input.value, input.baseline, {
    preferredDirection: input.preferredDirection,
    tolerancePct: input.tolerancePct,
    maxPenaltyPct: input.maxPenaltyPct,
  });
  return {
    key: input.key,
    label: input.label,
    value: input.value != null ? round(input.value, 1) : null,
    unit: input.unit ?? null,
    baseline: input.baseline != null ? round(input.baseline, 1) : null,
    deviationPct: score.deviationPct,
    confidence: input.value != null && input.baseline != null ? 0.8 : 0.2,
    source: input.source,
  };
}

function summarizeChannel(
  channel: InternalLoadChannelState["channel"],
  signals: InternalLoadSignal[],
  notes: string[],
): InternalLoadChannelState {
  const validSignals = signals.filter((signal) => signal.value != null || signal.baseline != null);
  const confidence = validSignals.length
    ? round(validSignals.reduce((sum, signal) => sum + (signal.confidence ?? 0.5), 0) / validSignals.length, 2)
    : 0.1;
  const score = validSignals.length
    ? round(
        validSignals.reduce((sum, signal) => {
          const signalScore = scoreFromRelativeDeviation(
            signal.value ?? null,
            signal.baseline ?? null,
            {
              preferredDirection:
                signal.key.includes("resting_hr") || signal.key.includes("strain") || signal.key.includes("cortisol")
                  ? "lower"
                  : "higher",
              tolerancePct: 5,
              maxPenaltyPct: 30,
            },
          ).score;
          return sum + signalScore;
        }, 0) / validSignals.length,
        1,
      )
    : 50;
  const status =
    score >= 72 ? "supported" : score >= 55 ? "compensated" : score > 0 ? "strained" : "unknown";

  return {
    channel,
    score,
    confidence,
    status,
    notes,
    signals,
  };
}

function pickPanelValue(row: Record<string, unknown> | null, keys: string[]): number | null {
  const values = row?.values && typeof row.values === "object" ? (row.values as Record<string, unknown>) : null;
  if (!values) return null;
  for (const key of keys) {
    const candidate = asNum(values[key]);
    if (candidate != null) return candidate;
  }
  return null;
}

export async function resolveInternalLoadState(
  input: ResolveInternalLoadStateInput,
): Promise<InternalLoadState> {
  const supabase = createServerSupabaseClient();
  const today = new Date();
  const calibrationFrom = addDays(today, -42).toISOString();
  const acuteFrom = addDays(today, -7).toISOString();

  const [physiologyState, executedRes, plannedRes, deviceExportsRes, panelsRes] = await Promise.all([
    input.physiologyState ?? resolveCanonicalPhysiologyState(input.athleteId),
    input.executedRows
      ? Promise.resolve({ data: input.executedRows, error: null })
      : supabase
          .from("executed_workouts")
          .select("date, tss, duration_minutes, trace_summary, lactate_mmoll, glucose_mmol, smo2")
          .eq("athlete_id", input.athleteId)
          .gte("date", calibrationFrom.slice(0, 10))
          .order("date", { ascending: true }),
    input.plannedRows
      ? Promise.resolve({ data: input.plannedRows, error: null })
      : supabase
          .from("planned_workouts")
          .select("date, tss_target, duration_minutes")
          .eq("athlete_id", input.athleteId)
          .gte("date", acuteFrom.slice(0, 10))
          .order("date", { ascending: true }),
    supabase
      .from("device_sync_exports")
      .select("provider, payload, created_at")
      .eq("athlete_id", input.athleteId)
      .gte("created_at", calibrationFrom)
      .order("created_at", { ascending: true }),
    supabase
      .from("biomarker_panels")
      .select("type, sample_date, values, created_at")
      .eq("athlete_id", input.athleteId)
      .gte("created_at", calibrationFrom)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (executedRes.error) throw new Error(executedRes.error.message);
  if (plannedRes.error) throw new Error(plannedRes.error.message);
  if (deviceExportsRes.error) throw new Error(deviceExportsRes.error.message);
  if (panelsRes.error) throw new Error(panelsRes.error.message);

  const executedRows = (executedRes.data ?? []) as ExecutedWorkoutLoadRow[];
  const plannedRows = (plannedRes.data ?? []) as PlannedWorkoutRow[];
  const deviceRows = ((deviceExportsRes.data ?? []) as Array<Record<string, unknown>>) ?? [];
  const panelRows = ((panelsRes.data ?? []) as Array<Record<string, unknown>>) ?? [];
  const loadSeries = computeDailyLoadSeries(executedRows);
  const latestLoad = loadSeries.at(-1);
  const plannedTssNext7d = plannedRows.reduce((sum, row) => sum + Math.max(0, asNum(row.tss_target) ?? 0), 0);

  const sleepSignals = deviceRows.map(extractSignalFromDeviceExportRow);
  const baselineHrv = median(sleepSignals.map((row) => row.hrvMs).filter((value): value is number => value != null));
  const recentHrv = average(sleepSignals.slice(-7).map((row) => row.hrvMs).filter((value): value is number => value != null));
  const baselineRestingHr = median(sleepSignals.map((row) => row.restingHrBpm).filter((value): value is number => value != null));
  const recentRestingHr = average(sleepSignals.slice(-7).map((row) => row.restingHrBpm).filter((value): value is number => value != null));
  const baselineSleepScore = median(sleepSignals.map((row) => row.sleepScore).filter((value): value is number => value != null));
  const recentSleepScore = average(sleepSignals.slice(-7).map((row) => row.sleepScore).filter((value): value is number => value != null));
  const baselineSleepHours = median(sleepSignals.map((row) => row.sleepDurationHours).filter((value): value is number => value != null));
  const recentSleepHours = average(sleepSignals.slice(-7).map((row) => row.sleepDurationHours).filter((value): value is number => value != null));
  const baselineReadiness = median(
    sleepSignals.map((row) => row.readinessScore ?? row.recoveryScore).filter((value): value is number => value != null),
  );
  const recentReadiness = average(
    sleepSignals.slice(-7).map((row) => row.readinessScore ?? row.recoveryScore).filter((value): value is number => value != null),
  );
  const baselineStrain = median(sleepSignals.map((row) => row.strainScore).filter((value): value is number => value != null));
  const recentStrain = average(sleepSignals.slice(-7).map((row) => row.strainScore).filter((value): value is number => value != null));

  const bloodPanel = panelRows.find((row) => String(row.type ?? "").toLowerCase() === "blood") ?? null;
  const microbiotaPanel = panelRows.find((row) => String(row.type ?? "").toLowerCase() === "microbiota") ?? null;

  const autonomicChannel = summarizeChannel(
    "autonomic",
    [
      buildSignal({
        key: "hrv_ms",
        label: "HRV",
        value: recentHrv ?? physiologyState.recoveryProfile.baselineHrvMs ?? null,
        baseline: baselineHrv ?? physiologyState.recoveryProfile.baselineHrvMs ?? null,
        unit: "ms",
        preferredDirection: "higher",
        tolerancePct: 6,
        maxPenaltyPct: 30,
        source: "reality.sleep_recovery",
      }),
      buildSignal({
        key: "resting_hr_bpm",
        label: "Resting HR",
        value: recentRestingHr ?? physiologyState.recoveryProfile.restingHrBpm ?? null,
        baseline: baselineRestingHr ?? physiologyState.recoveryProfile.restingHrBpm ?? null,
        unit: "bpm",
        preferredDirection: "lower",
        tolerancePct: 4,
        maxPenaltyPct: 18,
        source: "reality.sleep_recovery",
      }),
      buildSignal({
        key: "strain_score",
        label: "Strain",
        value: recentStrain,
        baseline: baselineStrain,
        unit: "score",
        preferredDirection: "lower",
        tolerancePct: 8,
        maxPenaltyPct: 35,
        source: "reality.sleep_recovery",
      }),
    ],
    ["Autonomic channel combines HRV, resting HR and recovery strain across the rolling window."],
  );

  const sleepChannel = summarizeChannel(
    "sleep_circadian",
    [
      buildSignal({
        key: "sleep_score",
        label: "Sleep score",
        value: recentSleepScore,
        baseline: baselineSleepScore,
        unit: "score",
        preferredDirection: "higher",
        tolerancePct: 5,
        maxPenaltyPct: 25,
        source: "reality.sleep_recovery",
      }),
      buildSignal({
        key: "sleep_duration_hours",
        label: "Sleep duration",
        value: recentSleepHours,
        baseline: baselineSleepHours ?? 7.5,
        unit: "h",
        preferredDirection: "higher",
        tolerancePct: 4,
        maxPenaltyPct: 20,
        source: "reality.sleep_recovery",
      }),
      buildSignal({
        key: "readiness_score",
        label: "Readiness",
        value: recentReadiness,
        baseline: baselineReadiness,
        unit: "score",
        preferredDirection: "higher",
        tolerancePct: 5,
        maxPenaltyPct: 25,
        source: "reality.sleep_recovery",
      }),
    ],
    ["Sleep channel uses rolling sleep score, sleep duration and readiness instead of a single nightly value."],
  );

  const endocrineChannel = summarizeChannel(
    "endocrine",
    [
      buildSignal({
        key: "cortisol",
        label: "Cortisol",
        value: pickPanelValue(bloodPanel, ["cortisol", "cortisol_am", "salivary_cortisol"]),
        baseline: pickPanelValue(bloodPanel, ["cortisol_baseline", "baseline_cortisol"]),
        unit: "a.u.",
        preferredDirection: "lower",
        tolerancePct: 8,
        maxPenaltyPct: 40,
        source: "biomarker_panels.blood",
      }),
      buildSignal({
        key: "testosterone_cortisol_ratio",
        label: "T/C ratio",
        value: pickPanelValue(bloodPanel, ["testosterone_cortisol_ratio", "tc_ratio"]),
        baseline: pickPanelValue(bloodPanel, ["baseline_testosterone_cortisol_ratio", "baseline_tc_ratio"]),
        unit: "ratio",
        preferredDirection: "higher",
        tolerancePct: 8,
        maxPenaltyPct: 35,
        source: "biomarker_panels.blood",
      }),
    ],
    ["Endocrine channel is trend-oriented and confidence-limited when lab coverage is sparse."],
  );

  const glycemicChannel = summarizeChannel(
    "glycemic",
    [
      buildSignal({
        key: "baseline_glucose",
        label: "Glucose baseline",
        value: physiologyState.recoveryProfile.baselineGlucoseMmol ?? null,
        baseline: 5.1,
        unit: "mmol/L",
        preferredDirection: "lower",
        tolerancePct: 4,
        maxPenaltyPct: 18,
        source: "physiology.recovery_profile",
      }),
      buildSignal({
        key: "hba1c_proxy",
        label: "HbA1c / glycemic proxy",
        value: pickPanelValue(bloodPanel, ["hba1c", "glycated_hemoglobin", "fasting_glucose"]),
        baseline: pickPanelValue(bloodPanel, ["baseline_hba1c", "baseline_fasting_glucose"]),
        unit: "a.u.",
        preferredDirection: "lower",
        tolerancePct: 5,
        maxPenaltyPct: 20,
        source: "biomarker_panels.blood",
      }),
    ],
    ["Glycemic channel supports interpretation of availability and stress, but does not replace glycogen logic."],
  );

  const hydrationCellularChannel = summarizeChannel(
    "hydration_cellular",
    [
      buildSignal({
        key: "phase_angle",
        label: "Phase angle",
        value: physiologyState.bioenergeticProfile.phaseAngleScore ?? null,
        baseline: physiologyState.bioenergeticProfile.phaseAngleScore ?? null,
        unit: "score",
        preferredDirection: "higher",
        tolerancePct: 3,
        maxPenaltyPct: 12,
        source: "bioenergetics.phase_angle",
      }),
      buildSignal({
        key: "hydration_status",
        label: "Hydration status",
        value: physiologyState.bioenergeticProfile.hydrationStatus ?? null,
        baseline: physiologyState.bioenergeticProfile.hydrationStatus ?? null,
        unit: "score",
        preferredDirection: "higher",
        tolerancePct: 4,
        maxPenaltyPct: 20,
        source: "bioenergetics.hydration",
      }),
      buildSignal({
        key: "cell_integrity",
        label: "Cell integrity",
        value: physiologyState.bioenergeticProfile.cellIntegrity ?? null,
        baseline: physiologyState.bioenergeticProfile.cellIntegrity ?? null,
        unit: "score",
        preferredDirection: "higher",
        tolerancePct: 4,
        maxPenaltyPct: 20,
        source: "bioenergetics.cellular",
      }),
    ],
    ["Hydration/cellular channel uses bioimpedance-derived proxies as a support layer, not as a standalone performance predictor."],
  );

  const entericChannel = summarizeChannel(
    "enteric",
    [
      buildSignal({
        key: "gut_stress",
        label: "Gut stress",
        value: physiologyState.lactateProfile.gutStressScore ?? null,
        baseline: physiologyState.lactateProfile.gutStressScore ?? null,
        unit: "score",
        preferredDirection: "lower",
        tolerancePct: 6,
        maxPenaltyPct: 30,
        source: "physiology.lactate_profile",
      }),
      buildSignal({
        key: "microbiota_dysbiosis",
        label: "Microbiota dysbiosis",
        value:
          physiologyState.lactateProfile.microbiotaDysbiosisScore ??
          pickPanelValue(microbiotaPanel, ["dysbiosis_score", "dysbiosis", "gut_inflammation_score"]),
        baseline: pickPanelValue(microbiotaPanel, ["baseline_dysbiosis_score", "baseline_dysbiosis"]),
        unit: "score",
        preferredDirection: "lower",
        tolerancePct: 5,
        maxPenaltyPct: 25,
        source: "physiology.microbiota",
      }),
    ],
    ["Enteric channel represents tolerance, barrier stress and microbiota-related strain."],
  );

  const neurocognitiveChannel = summarizeChannel(
    "neurocognitive",
    [
      buildSignal({
        key: "sleep_readiness_proxy",
        label: "Sleep-readiness proxy",
        value: recentReadiness ?? recentSleepScore,
        baseline: baselineReadiness ?? baselineSleepScore,
        unit: "score",
        preferredDirection: "higher",
        tolerancePct: 5,
        maxPenaltyPct: 20,
        source: "reality.sleep_recovery",
      }),
    ],
    ["Neurocognitive channel is currently a low-confidence proxy awaiting direct cognitive and brain-signal inputs."],
  );

  const channels = [
    autonomicChannel,
    sleepChannel,
    endocrineChannel,
    glycemicChannel,
    hydrationCellularChannel,
    entericChannel,
    neurocognitiveChannel,
  ];

  const weightedScore = channels.reduce((sum, channel) => sum + channel.score * channel.confidence, 0);
  const totalConfidence = channels.reduce((sum, channel) => sum + channel.confidence, 0);
  const internalLoadIndex = totalConfidence > 0 ? round(weightedScore / totalConfidence, 1) : 50;
  const recoveryCapacity = round(
    (sleepChannel.score * 0.28 +
      autonomicChannel.score * 0.24 +
      hydrationCellularChannel.score * 0.18 +
      endocrineChannel.score * 0.12 +
      glycemicChannel.score * 0.08 +
      entericChannel.score * 0.1),
    1,
  );
  const adaptationReadiness = round(
    clamp(recoveryCapacity * 0.7 + (100 - Math.max(0, latestLoad?.iAtl ?? 0)) * 0.3, 0, 100),
    1,
  );
  const expectedAdaptationScore = round(
    clamp((Math.max(0, latestLoad?.ctl ?? 0) * 0.4) + plannedTssNext7d * 0.18 + recoveryCapacity * 0.12, 0, 100),
    1,
  );
  const observedPhysiologicalResponse = round(
    clamp(
      ((physiologyState.performanceProfile.peripheralUtilizationIndex ?? 0.7) * 100) * 0.35 +
        (100 - (physiologyState.performanceProfile.redoxStressIndex ?? 20)) * 0.25 +
        (100 - (physiologyState.performanceProfile.oxidativeBottleneckIndex ?? 20)) * 0.2 +
        (physiologyState.metabolicProfile.fitConfidence ?? 70) * 0.2,
      0,
      100,
    ),
    1,
  );
  const observedBioenergeticResponse = round(
    clamp(
      (physiologyState.bioenergeticProfile.mitochondrialEfficiency ?? 60) * 0.3 +
        (physiologyState.bioenergeticProfile.hydrationStatus ?? 60) * 0.25 +
        (100 - (physiologyState.bioenergeticProfile.inflammationProxy ?? 25)) * 0.25 +
        (physiologyState.bioenergeticProfile.cellIntegrity ?? 60) * 0.2,
      0,
      100,
    ),
    1,
  );
  const observedRecoveryState = round((autonomicChannel.score + sleepChannel.score + recoveryCapacity) / 3, 1);
  const observedAdaptationScore = round(
    clamp(observedRecoveryState * 0.35 + observedPhysiologicalResponse * 0.4 + observedBioenergeticResponse * 0.25, 0, 100),
    1,
  );
  const divergenceRaw = round(expectedAdaptationScore - observedAdaptationScore, 1);
  const divergenceScore = round(Math.abs(divergenceRaw), 1);
  const likelyDrivers = [
    sleepChannel.score < 60 ? "sleep_circadian" : null,
    autonomicChannel.score < 60 ? "autonomic" : null,
    hydrationCellularChannel.score < 60 ? "hydration_cellular" : null,
    endocrineChannel.score < 58 ? "endocrine" : null,
    entericChannel.score < 58 ? "enteric" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    athleteId: input.athleteId,
    asOf: new Date().toISOString(),
    calibrationWindowDays: 42,
    acuteWindowDays: 7,
    mesoWindowDays: 14,
    internalLoadIndex,
    recoveryCapacity,
    adaptationReadiness,
    channels,
    expected: {
      targetLoadScore: round(Math.max(0, latestLoad?.external ?? 0), 1),
      expectedRecoveryCost: round(Math.max(0, latestLoad?.internal ?? 0), 1),
      expectedAdaptationScore,
      expectedTimeToAbsorbDays: round(clamp(plannedTssNext7d / 120, 1, 7), 1),
    },
    observed: {
      observedRecoveryState,
      observedPhysiologicalResponse,
      observedBioenergeticResponse,
      observedAdaptationScore,
    },
    divergence: {
      divergenceScore,
      direction: divergenceRaw > 6 ? "negative" : divergenceRaw < -6 ? "positive" : "neutral",
      likelyDrivers,
    },
  };
}
