import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  BioenergeticProfile,
  LactateProfile,
  MetabolicProfile,
  PerformanceProfile,
  PhysiologicalProfile,
  PhysiologyState,
  RecoveryProfile,
} from "@/lib/empathy/schemas";

type NumericMap = Record<string, number | null>;
export type CanonicalPhysiologyState = PhysiologyState;

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNum(record[key]);
    if (value != null) return value;
  }
  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return null;
}

function pickNumberFromRecords(records: Array<Record<string, unknown>>, keys: string[]): number | null {
  for (const record of records) {
    const value = pickNumber(record, keys);
    if (value != null) return value;
  }
  return null;
}

function pickStringFromRecords(records: Array<Record<string, unknown>>, keys: string[]): string | null {
  for (const record of records) {
    const value = pickString(record, keys);
    if (value != null) return value;
  }
  return null;
}

function mergeRecordsByRecency(records: Array<Record<string, unknown>>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const record of [...records].reverse()) {
    for (const [key, value] of Object.entries(record)) {
      if (value != null) merged[key] = value;
    }
  }
  return merged;
}

const CP_CURVE_LABELS = ["5s", "15s", "30s", "60s", "3m", "5m", "12m", "20m"] as const;

/** Curva CP durata→W dall’ultimo run Metabolic profile (`input_payload` o `output_payload.cp_curve_inputs_w`). */
function extractCpCurveInputsWFromLatestMetabolicRun(run: Record<string, unknown> | null): Record<string, number> | undefined {
  if (!run) return undefined;
  const input = recordOf(run.input_payload);
  const output = recordOf(run.output_payload);
  const embedded = recordOf(output.cp_curve_inputs_w ?? output.cpCurveInputsW);
  const out: Record<string, number> = {};
  for (const label of CP_CURVE_LABELS) {
    const n = asNum(embedded[label]) ?? asNum(input[label]);
    if (n != null && n > 0) out[label] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function compactNumericRecord(input: Record<string, number | null>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value != null && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

function buildZones(ftpWatts: number | undefined) {
  if (!ftpWatts || !Number.isFinite(ftpWatts) || ftpWatts <= 0) return undefined;
  const zones = [
    { name: "Z1", lowPct: 0.5, highPct: 0.62 },
    { name: "Z2", lowPct: 0.63, highPct: 0.74 },
    { name: "Z3", lowPct: 0.75, highPct: 0.86 },
    { name: "Z4", lowPct: 0.87, highPct: 0.98 },
    { name: "Z5", lowPct: 0.99, highPct: 1.07 },
    { name: "Z6", lowPct: 1.08, highPct: 1.14 },
    { name: "Z7", lowPct: 1.15, highPct: 1.28 },
  ];
  return zones.map((zone) => ({
    ...zone,
    lowWatts: Math.round(ftpWatts * zone.lowPct),
    highWatts: Math.round(ftpWatts * zone.highPct),
  }));
}

export async function resolveCanonicalPhysiologyState(athleteId: string): Promise<CanonicalPhysiologyState> {
  const supabase = createServerSupabaseClient();
  const [profileRes, runsRes, athleteRes, biomarkerRes] = await Promise.all([
    supabase
      .from("physiological_profiles")
      .select(
        "athlete_id, ftp_watts, lt1_watts, lt2_watts, v_lamax, vo2max_ml_min_kg, baseline_hrv_ms, baseline_hrv_std, baseline_temp_c, baseline_glucose_mmol, updated_at",
      )
      .eq("athlete_id", athleteId)
      .maybeSingle(),
    supabase
      .from("metabolic_lab_runs")
      .select("section, input_payload, output_payload, created_at")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("athlete_profiles")
      .select("weight_kg, resting_hr_bpm, max_hr_bpm")
      .eq("id", athleteId)
      .maybeSingle(),
    supabase
      .from("biomarker_panels")
      .select("type, source, sample_date, values, created_at")
      .eq("athlete_id", athleteId)
      .order("sample_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (runsRes.error) throw new Error(runsRes.error.message);
  if (athleteRes.error) throw new Error(athleteRes.error.message);
  if (biomarkerRes.error) throw new Error(biomarkerRes.error.message);

  const profileRow = recordOf(profileRes.data);
  const athleteRow = recordOf(athleteRes.data);
  const runs = (runsRes.data ?? []) as Array<Record<string, unknown>>;
  const biomarkerPanels = (biomarkerRes.data ?? []) as Array<Record<string, unknown>>;

  const metabolicRuns = runs.filter((run) => String(run.section ?? "") === "metabolic_profile");
  const lactateRuns = runs.filter((run) => String(run.section ?? "") === "lactate_analysis");
  const performanceRuns = runs.filter((run) => String(run.section ?? "") === "max_oxidate");
  const metabolicRun = (metabolicRuns[0] as Record<string, unknown> | undefined) ?? null;
  const lactateRun = lactateRuns[0] ?? null;
  const performanceRun = performanceRuns[0] ?? null;

  const bioPanel =
    biomarkerPanels.find((panel) => {
      const type = String(panel.type ?? "").toLowerCase();
      return type === "bioenergetics" || type === "bia";
    }) ?? null;
  const bioValues = recordOf(bioPanel?.values);
  const metabolicRunRecords = metabolicRuns.map((run) => recordOf(run.output_payload));
  const lactateRunRecords = lactateRuns.map((run) => recordOf(run.output_payload));
  const performanceRunRecords = performanceRuns.map((run) => recordOf(run.output_payload));
  const metabolicValues = mergeRecordsByRecency(metabolicRunRecords);
  const lactateValues = mergeRecordsByRecency(lactateRunRecords);
  const performanceValues = mergeRecordsByRecency(performanceRunRecords);

  const ftpWatts =
    pickNumberFromRecords(metabolicRunRecords, ["ftp_watts", "ftp_w", "ftp", "ftpWatts"]) ??
    asNum(profileRow.ftp_watts) ??
    pickNumberFromRecords(performanceRunRecords, ["ftp_w", "ftp", "ftpWatts"]) ??
    pickNumberFromRecords(lactateRunRecords, ["ftp_w", "ftp", "ftpWatts"]) ??
    pickNumberFromRecords(metabolicRunRecords, ["mechanical_equivalent_cycling_w", "multisport_p_final_w"]) ??
    undefined;
  const lt1Watts =
    pickNumberFromRecords(metabolicRunRecords, ["lt1_watts", "lt1_w", "lt1", "lt1Watts"]) ??
    asNum(profileRow.lt1_watts) ??
    pickNumberFromRecords(lactateRunRecords, ["lt1_w", "lt1", "lt1Watts"]) ??
    undefined;
  const lt2Watts =
    pickNumberFromRecords(metabolicRunRecords, ["lt2_watts", "lt2_w", "lt2", "lt2Watts"]) ??
    asNum(profileRow.lt2_watts) ??
    pickNumberFromRecords(lactateRunRecords, ["lt2_w", "lt2", "lt2Watts"]) ??
    undefined;
  const vo2maxMlMinKg =
    pickNumberFromRecords(metabolicRunRecords, ["vo2max_ml_min_kg", "vo2max", "vo2RelMlKgMin"]) ??
    asNum(profileRow.vo2max_ml_min_kg) ??
    pickNumberFromRecords(performanceRunRecords, ["vo2max_ml_min_kg", "vo2RelMlKgMin", "vo2max"]) ??
    undefined;
  const economy =
    pickNumberFromRecords(metabolicRunRecords, ["economy", "grossEfficiency", "mechanical_efficiency", "efficiency"]) ??
    pickNumberFromRecords(performanceRunRecords, ["efficiency", "economy", "grossEfficiency", "mechanical_efficiency"]) ??
    undefined;
  const substrateRates = {
    choGMin: pickNumberFromRecords(metabolicRunRecords, ["cho_g_min", "choGMin", "carb_g_min"]),
    fatGMin: pickNumberFromRecords(metabolicRunRecords, ["fat_g_min", "fatGMin"]),
    glycogenUseGMin: pickNumberFromRecords(metabolicRunRecords, ["glycogen_g_min", "glycogenUseGMin"]),
  };

  const physiologicalProfile: PhysiologicalProfile = {
    id: athleteId,
    athleteId,
    ftpWatts,
    cpWatts:
      pickNumberFromRecords(metabolicRunRecords, ["cp_w", "cp", "critical_power_w"]) ??
      pickNumberFromRecords(performanceRunRecords, ["cp_w", "cp", "critical_power_w"]) ??
      undefined,
    lt1Watts,
    lt1HeartRate: pickNumberFromRecords(lactateRunRecords, ["lt1_hr", "lt1_bpm", "lt1HeartRate"]) ?? undefined,
    lt2Watts,
    lt2HeartRate: pickNumberFromRecords(lactateRunRecords, ["lt2_hr", "lt2_bpm", "lt2HeartRate"]) ?? undefined,
    zones: buildZones(ftpWatts),
    vLamax:
      pickNumberFromRecords(metabolicRunRecords, ["v_lamax", "vlamax", "vlamax_proxy"]) ??
      asNum(profileRow.v_lamax) ??
      pickNumberFromRecords(lactateRunRecords, ["v_lamax", "vlamax", "vlamax_proxy"]) ??
      undefined,
    vo2maxMlMinKg,
    economy,
    baselineHrvMs: asNum(profileRow.baseline_hrv_ms) ?? undefined,
    baselineHrvStd: asNum(profileRow.baseline_hrv_std) ?? undefined,
    baselineTempC: asNum(profileRow.baseline_temp_c) ?? undefined,
    baselineGlucoseMmol: asNum(profileRow.baseline_glucose_mmol) ?? undefined,
    substrateRates: compactNumericRecord(substrateRates),
    updatedAt: typeof profileRow.updated_at === "string" ? profileRow.updated_at : undefined,
  };

  const metabolicProfile: MetabolicProfile = {
    latestRunAt: typeof metabolicRun?.created_at === "string" ? String(metabolicRun.created_at) : undefined,
    version: pickStringFromRecords(metabolicRunRecords, ["version", "model_version"]) ?? undefined,
    ftpWatts,
    cpWatts:
      pickNumberFromRecords(metabolicRunRecords, ["cp_w", "cp", "critical_power_w"]) ??
      pickNumberFromRecords(performanceRunRecords, ["cp_w", "cp", "critical_power_w"]) ??
      undefined,
    lt1Watts,
    lt2Watts,
    fatmaxWatts: pickNumberFromRecords(metabolicRunRecords, ["fatmax_w", "fatmax", "fatmaxWatts"]) ?? undefined,
    vLamax:
      pickNumberFromRecords(metabolicRunRecords, ["v_lamax", "vlamax", "vlamax_proxy"]) ??
      asNum(profileRow.v_lamax) ??
      pickNumberFromRecords(lactateRunRecords, ["v_lamax", "vlamax", "vlamax_proxy"]) ??
      undefined,
    sprintReserveWatts: pickNumberFromRecords(metabolicRunRecords, ["sprintReserve", "sprint_reserve_w", "sprintReserveWatts"]) ?? undefined,
    wPrimeJ: pickNumberFromRecords(metabolicRunRecords, ["wPrimeJ", "w_prime_j", "wprime_j"]) ?? undefined,
    pcrCapacityJ: pickNumberFromRecords(metabolicRunRecords, ["pcrCapacityJ", "pcr_capacity_j"]) ?? undefined,
    glycolyticCapacityJ: pickNumberFromRecords(metabolicRunRecords, ["glycolyticCapacityJ", "glycolytic_capacity_j"]) ?? undefined,
    fitR2: pickNumberFromRecords(metabolicRunRecords, ["fitR2", "fit_r2"]) ?? undefined,
    fitConfidence: pickNumberFromRecords(metabolicRunRecords, ["fitConfidence", "fit_confidence"]) ?? undefined,
    fitModel: pickStringFromRecords(metabolicRunRecords, ["fitModel", "fit_model"]) ?? undefined,
    phenotype: pickStringFromRecords(metabolicRunRecords, ["phenotype"]) ?? undefined,
    economy,
    substrateRates: compactNumericRecord(substrateRates),
    substrateTable: Array.isArray(metabolicValues.substrateTable)
      ? (metabolicValues.substrateTable as Array<Record<string, unknown>>)
      : undefined,
    powerComponents: Array.isArray(metabolicValues.powerComponents)
      ? (metabolicValues.powerComponents as Array<Record<string, unknown>>)
      : undefined,
    cpCurveInputsW: extractCpCurveInputsWFromLatestMetabolicRun(metabolicRun),
    latestValues: metabolicValues,
  };

  const lactateProfile: LactateProfile = {
    latestRunAt: typeof lactateRun?.created_at === "string" ? String(lactateRun.created_at) : undefined,
    version: pickString(lactateValues, ["version", "model_version"]) ?? undefined,
    intensityPctFtp: pickNumber(lactateValues, ["intensityPctFtp", "intensity_pct_ftp"]) ?? undefined,
    energyDemandKcal: pickNumber(lactateValues, ["energyDemandKcal", "energy_demand_kcal"]) ?? undefined,
    glycolyticSharePct: pickNumber(lactateValues, ["glycolyticSharePct", "glycolytic_share_pct"]) ?? undefined,
    choKcal: pickNumber(lactateValues, ["choKcal", "cho_kcal"]) ?? undefined,
    nonChoKcal: pickNumber(lactateValues, ["nonChoKcal", "non_cho_kcal"]) ?? undefined,
    aerobicKcal: pickNumber(lactateValues, ["aerobicKcal", "aerobic_kcal"]) ?? undefined,
    anaerobicKcal: pickNumber(lactateValues, ["anaerobicKcal", "anaerobic_kcal"]) ?? undefined,
    glycogenCombustedGrossG: pickNumber(lactateValues, ["glycogenCombustedGrossG", "glycogen_combusted_gross_g"]) ?? undefined,
    glycogenCombustedNetG: pickNumber(lactateValues, ["glycogenCombustedNetG", "glycogen_combusted_net_g"]) ?? undefined,
    lactateProducedG: pickNumber(lactateValues, ["lactateProducedG", "lactate_produced_g"]) ?? undefined,
    lactateOxidizedG: pickNumber(lactateValues, ["lactateOxidizedG", "lactate_oxidized_g"]) ?? undefined,
    lactateCoriG: pickNumber(lactateValues, ["lactateCoriG", "lactate_cori_g"]) ?? undefined,
    lactateAccumG: pickNumber(lactateValues, ["lactateAccumG", "lactate_accum_g"]) ?? undefined,
    glucoseFromCoriG: pickNumber(lactateValues, ["glucoseFromCoriG", "glucose_from_cori_g"]) ?? undefined,
    glucoseNetFromCoriG: pickNumber(lactateValues, ["glucoseNetFromCoriG", "glucose_net_from_cori_g"]) ?? undefined,
    coriCostKcal: pickNumber(lactateValues, ["coriCostKcal", "cori_cost_kcal"]) ?? undefined,
    choIngestedTotalG: pickNumber(lactateValues, ["choIngestedTotalG", "cho_ingested_total_g"]) ?? undefined,
    choAfterAbsorptionG: pickNumber(lactateValues, ["choAfterAbsorptionG", "cho_after_absorption_g"]) ?? undefined,
    microbiotaSequestrationG: pickNumber(lactateValues, ["microbiotaSequestrationG", "microbiota_sequestration_g"]) ?? undefined,
    choIntoBloodstreamG: pickNumber(lactateValues, ["choIntoBloodstreamG", "cho_into_bloodstream_g"]) ?? undefined,
    bloodDeliveryPctOfIngested: pickNumber(lactateValues, ["bloodDeliveryPctOfIngested", "blood_delivery_pct_of_ingested"]) ?? undefined,
    microbiotaPredationPctOfIngested:
      pickNumber(lactateValues, ["microbiotaPredationPctOfIngested", "microbiota_predation_pct_of_ingested"]) ?? undefined,
    effectiveSequestrationPct: pickNumber(lactateValues, ["effectiveSequestrationPct", "effective_sequestration_pct"]) ?? undefined,
    microbiotaDysbiosisScore: pickNumber(lactateValues, ["microbiotaDysbiosisScore", "microbiota_dysbiosis_score"]) ?? undefined,
    exogenousOxidizedG: pickNumber(lactateValues, ["exogenousOxidizedG", "exogenous_oxidized_g"]) ?? undefined,
    gutStressScore: pickNumber(lactateValues, ["gutStressScore", "gut_stress_score"]) ?? undefined,
    fermentationLoadScore: pickNumber(lactateValues, ["fermentationLoadScore", "fermentation_load_score"]) ?? undefined,
    gutPathwayRisk: pickString(lactateValues, ["gutPathwayRisk", "gut_pathway_risk"]) ?? undefined,
    glucoseRequiredForStrategyG: pickNumber(lactateValues, ["glucoseRequiredForStrategyG", "glucose_required_for_strategy_g"]) ?? undefined,
    latestValues: lactateValues,
  };

  const performanceProfile: PerformanceProfile = {
    latestRunAt: typeof performanceRun?.created_at === "string" ? String(performanceRun.created_at) : undefined,
    version: pickString(performanceValues, ["version", "model_version"]) ?? undefined,
    vo2maxMlMinKg,
    intensityPctFtp: pickNumber(performanceValues, ["intensityPctFtp", "intensity_pct_ftp"]) ?? undefined,
    oxidativeCapacityKcalMinGross:
      pickNumber(performanceValues, ["oxidativeCapacityKcalMinGross", "oxidative_capacity_kcal_min_gross"]) ?? undefined,
    oxidativeCapacityKcalMin: pickNumber(performanceValues, ["oxidativeCapacityKcalMin", "oxidative_capacity_kcal_min"]) ?? undefined,
    requiredKcalMin: pickNumber(performanceValues, ["requiredKcalMin", "required_kcal_min"]) ?? undefined,
    oxidativeDemandKcalMin:
      pickNumber(performanceValues, ["oxidativeDemandKcalMin", "oxidative_demand_kcal_min"]) ?? undefined,
    aerobicPowerDemandW: pickNumber(performanceValues, ["aerobicPowerDemandW", "aerobic_power_demand_w"]) ?? undefined,
    glycolyticPowerDemandW:
      pickNumber(performanceValues, ["glycolyticPowerDemandW", "glycolytic_power_demand_w"]) ?? undefined,
    utilizationRatioPct: pickNumber(performanceValues, ["utilizationRatioPct", "utilization_ratio_pct"]) ?? undefined,
    utilizationVo2CoherencePct:
      pickNumber(performanceValues, ["utilizationVo2CoherencePct", "utilization_vo2_coherence_pct"]) ?? undefined,
    utilizationDeliveryStressPct:
      pickNumber(performanceValues, ["utilizationDeliveryStressPct", "utilization_delivery_stress_pct"]) ?? undefined,
    oxidativeBottleneckIndex: pickNumber(performanceValues, ["oxidativeBottleneckIndex", "oxidative_bottleneck_index"]) ?? undefined,
    redoxStressIndex: pickNumber(performanceValues, ["redoxStressIndex", "redox_stress_index"]) ?? undefined,
    centralDeliveryIndex: pickNumber(performanceValues, ["centralDeliveryIndex", "central_delivery_index"]) ?? undefined,
    peripheralUtilizationIndex: pickNumber(performanceValues, ["peripheralUtilizationIndex", "peripheral_utilization_index"]) ?? undefined,
    extractionPct: pickNumber(performanceValues, ["extractionPct", "extraction_pct"]) ?? undefined,
    nadhPressureIndex: pickNumber(performanceValues, ["nadhPressureIndex", "nadh_pressure_index"]) ?? undefined,
    reoxidationCapacityIndex: pickNumber(performanceValues, ["reoxidationCapacityIndex", "reoxidation_capacity_index"]) ?? undefined,
    bottleneckType: pickString(performanceValues, ["bottleneckType", "bottleneck_type"]) ?? undefined,
    state: pickString(performanceValues, ["state"]) ?? undefined,
    economy,
    restingHrBpm: asNum(athleteRow.resting_hr_bpm) ?? undefined,
    maxHrBpm: asNum(athleteRow.max_hr_bpm) ?? undefined,
    latestValues: performanceValues,
  };

  const recoveryProfile: RecoveryProfile = {
    baselineHrvMs: asNum(profileRow.baseline_hrv_ms) ?? undefined,
    baselineHrvStd: asNum(profileRow.baseline_hrv_std) ?? undefined,
    baselineTempC: asNum(profileRow.baseline_temp_c) ?? undefined,
    baselineGlucoseMmol: asNum(profileRow.baseline_glucose_mmol) ?? undefined,
    restingHrBpm: asNum(athleteRow.resting_hr_bpm) ?? undefined,
    maxHrBpm: asNum(athleteRow.max_hr_bpm) ?? undefined,
    latestValues: {
      baseline_hrv_ms: asNum(profileRow.baseline_hrv_ms),
      baseline_hrv_std: asNum(profileRow.baseline_hrv_std),
      baseline_temp_c: asNum(profileRow.baseline_temp_c),
      baseline_glucose_mmol: asNum(profileRow.baseline_glucose_mmol),
    },
  };

  const derivedBioRaw = {
    metabolic: metabolicValues,
    lactate: lactateValues,
    performance: performanceValues,
    panel: bioValues,
  };
  const bioenergeticProfile: BioenergeticProfile = {
    source:
      bioPanel
        ? String(bioPanel.source ?? bioPanel.type ?? "biomarker_panel")
        : performanceRun
          ? "max_oxidate_proxy"
          : lactateRun
            ? "lactate_proxy"
            : null,
    phaseAngleScore: pickNumber(bioValues, ["phase_angle_score", "phase_angle", "phaseAngle"]) ?? undefined,
    cellIntegrity: pickNumber(bioValues, ["cell_integrity", "cell_integrity_score"]) ?? undefined,
    mitochondrialEfficiency:
      pickNumber(bioValues, ["mitochondrial_efficiency", "mitochondrial_efficiency_score"]) ??
      (() => {
        const proxy = pickNumber(performanceValues, ["reoxidationCapacityIndex", "reoxidation_capacity_index"]);
        return proxy != null ? Number((proxy * 100).toFixed(2)) : undefined;
      })(),
    hydrationStatus:
      pickNumber(bioValues, ["hydration_status", "hydration_score", "fluid_distribution_score"]) ??
      (() => {
        const proxy = pickNumber(lactateValues, ["bloodDeliveryPctOfIngested", "blood_delivery_pct_of_ingested"]);
        return proxy != null ? Number(proxy.toFixed(2)) : undefined;
      })(),
    inflammationProxy:
      pickNumber(bioValues, ["inflammation_proxy", "inflammation_score"]) ??
      pickNumber(performanceValues, ["redoxStressIndex", "redox_stress_index"]) ??
      undefined,
    raw: derivedBioRaw,
  };

  return {
    athleteId,
    computedAt: new Date().toISOString(),
    physiologicalProfile,
    metabolicProfile,
    lactateProfile,
    performanceProfile,
    recoveryProfile,
    bioenergeticProfile,
    sources: {
      physiologicalProfile: Boolean(profileRes.data),
      metabolicRun: Boolean(metabolicRun),
      lactateRun: Boolean(lactateRun),
      performanceRun: Boolean(performanceRun),
      biomarkerPanel: Boolean(bioPanel),
    },
  };
}
