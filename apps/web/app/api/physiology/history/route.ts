import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { estimateVo2FromDevice } from "@/lib/engines/vo2-estimator";
import { resolveCanonicalPhysiologyState } from "@/lib/physiology/profile-resolver";

export const runtime = "nodejs";

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fromTrace(trace: unknown, keys: string[]): number | null {
  if (!trace || typeof trace !== "object") return null;
  const rec = trace as Record<string, unknown>;
  for (const key of keys) {
    const n = asNum(rec[key]);
    if (n != null) return n;
  }
  return null;
}

function pickValue(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const n = asNum(record[key]);
    if (n != null) return n;
  }
  return null;
}

/** Valori pannello sangue Health → mmol/L per il lab Lactate (allineato a `HealthPageView` rowFromBloodPanel). */
function bloodGlucoseMmolFromPanel(values: Record<string, unknown>): number | null {
  const mmolExplicit = pickValue(values, [
    "glicemia_mmol_l",
    "glucose_mmol_l",
    "blood_glucose_mmol_l",
    "fasting_glucose_mmol_l",
    "glucose_mmol",
  ]);
  if (mmolExplicit != null && mmolExplicit >= 2 && mmolExplicit <= 15) return mmolExplicit;

  const mgDl = pickValue(values, ["fasting_glucose_mg_dl", "glucose_mg_dl", "glicemia_mg_dl"]);
  if (mgDl != null && mgDl > 40 && mgDl < 500) return mgDl / 18;

  const ambig = pickValue(values, ["glicemia", "glucose", "glucosio"]);
  if (ambig == null) return null;
  if (ambig >= 2 && ambig <= 15) return ambig;
  if (ambig > 25) return ambig / 18;
  return null;
}

function fromTraceText(trace: unknown, keys: string[]): string | null {
  if (!trace || typeof trace !== "object") return null;
  const rec = trace as Record<string, unknown>;
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const athleteId = (searchParams.get("athleteId") ?? "").trim();
    if (!athleteId) return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });

    const { db } = await requireAthleteReadContext(req, athleteId);

    const [historyRes, physiologyState, executedRes, profileRes, microbiotaPanelRes, bloodPanelRes] =
      await Promise.all([
      db
        .from("metabolic_lab_runs")
        .select("id, section, model_version, created_at, input_payload, output_payload")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(8),
      resolveCanonicalPhysiologyState(athleteId),
      db
        .from("executed_workouts")
        .select("id, date, duration_minutes, tss, trace_summary, lactate_mmoll, glucose_mmol, smo2")
        .eq("athlete_id", athleteId)
        .order("date", { ascending: false })
        .limit(24),
      db
        .from("athlete_profiles")
        .select("weight_kg, resting_hr_bpm, max_hr_bpm")
        .eq("id", athleteId)
        .maybeSingle(),
      db
        .from("biomarker_panels")
        .select("id, type, sample_date, values, source, created_at")
        .eq("athlete_id", athleteId)
        .eq("type", "microbiota")
        .order("sample_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1),
      db
        .from("biomarker_panels")
        .select("id, type, sample_date, values, source, created_at")
        .eq("athlete_id", athleteId)
        .eq("type", "blood")
        .order("sample_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    if (historyRes.error) return NextResponse.json({ error: historyRes.error.message }, { status: 500 });
    if (executedRes.error) return NextResponse.json({ error: executedRes.error.message }, { status: 500 });
    if (profileRes.error) return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
    if (microbiotaPanelRes.error) return NextResponse.json({ error: microbiotaPanelRes.error.message }, { status: 500 });
    if (bloodPanelRes.error) return NextResponse.json({ error: bloodPanelRes.error.message }, { status: 500 });

    const ftp = Number(physiologyState.physiologicalProfile.ftpWatts ?? 0);
    const vo2maxMlMinKgCanon = physiologyState.physiologicalProfile.vo2maxMlMinKg ?? null;
    const executed =
      ((executedRes.data ?? []) as Array<{
        id: string | null;
        date: string | null;
        duration_minutes: number | null;
        tss: number | null;
        trace_summary: Record<string, unknown> | null;
        lactate_mmoll: number | null;
        glucose_mmol: number | null;
        smo2: number | null;
      }>) ?? [];
    const profile = (profileRes.data as { weight_kg?: number | null } | null) ?? null;
    const microbiotaPanel = ((microbiotaPanelRes.data ?? [])[0] as { values?: Record<string, unknown> | null } | undefined) ?? null;
    const microbiotaValues = (microbiotaPanel?.values ?? {}) as Record<string, unknown>;

    const durationAvg =
      executed.length > 0
        ? executed.reduce((s, row) => s + Math.max(0, Number(row.duration_minutes ?? 0)), 0) / executed.length
        : 60;
    const tssAvg =
      executed.length > 0
        ? executed.reduce((s, row) => s + Math.max(0, Number(row.tss ?? 0)), 0) / executed.length
        : 90;
    const intensityFactor = Math.max(0.45, Math.min(1.25, tssAvg / Math.max(1, durationAvg * 1.2)));
    const inferredFtp = Number.isFinite(ftp) && ftp > 0 ? ftp : 300;
    const inferredPower = inferredFtp * intensityFactor;

    const hrAvgList = executed
      .map((row) => fromTrace(row.trace_summary, ["hr_avg_bpm", "avg_hr", "heart_rate_avg"]))
      .filter((v): v is number => v != null);
    const hrMaxList = executed
      .map((row) => fromTrace(row.trace_summary, ["hr_max_bpm", "max_hr", "heart_rate_max"]))
      .filter((v): v is number => v != null);
    const smo2List = executed
      .map((row) => asNum(row.smo2) ?? fromTrace(row.trace_summary, ["smo2", "smo2_avg_pct"]))
      .filter((v): v is number => v != null);
    const lactateList = executed
      .map((row) => asNum(row.lactate_mmoll) ?? fromTrace(row.trace_summary, ["lactate_mmoll", "lactate_mmol_l"]))
      .filter((v): v is number => v != null);
    const glucoseSessionList = executed
      .map((row) => asNum(row.glucose_mmol) ?? fromTrace(row.trace_summary, ["glucose_mmol", "blood_glucose_mmol_l"]))
      .filter((v): v is number => v != null && v >= 2 && v <= 22);

    const avgHr = hrAvgList.length > 0 ? hrAvgList.reduce((s, v) => s + v, 0) / hrAvgList.length : 150;
    const maxHr = hrMaxList.length > 0 ? Math.max(...hrMaxList) : 185;
    const avgSmo2 = smo2List.length > 0 ? smo2List.reduce((s, v) => s + v, 0) / smo2List.length : 45;
    const avgLactate = lactateList.length > 0 ? lactateList.reduce((s, v) => s + v, 0) / lactateList.length : 4.0;
    const avgGlucoseSessions =
      glucoseSessionList.length > 0
        ? glucoseSessionList.reduce((s, v) => s + v, 0) / glucoseSessionList.length
        : null;

    const rerProxy = Math.max(0.82, Math.min(1.02, 0.84 + intensityFactor * 0.16));
    const restingHrProxy = Math.max(40, Math.round(avgHr * 0.72));
    const bodyMassKg = Number(profile?.weight_kg ?? 70);
    const vo2Proxy = estimateVo2FromDevice({
      sport: "cycling",
      bodyMassKg,
      rer: rerProxy,
      efficiency: 0.24,
      powerW: inferredPower,
    }).vo2LMin;
    const vo2FromProfileLMin =
      vo2maxMlMinKgCanon != null &&
      Number.isFinite(vo2maxMlMinKgCanon) &&
      vo2maxMlMinKgCanon >= 20 &&
      bodyMassKg > 0
        ? Number(((vo2maxMlMinKgCanon * bodyMassKg) / 1000).toFixed(3))
        : null;
    const vo2ForAuto = vo2FromProfileLMin ?? vo2Proxy;
    const smo2RestProxy = Math.max(58, Math.min(78, avgSmo2 + 22));
    const smo2WorkProxy = Math.max(12, Math.min(65, avgSmo2));

    const lactateAuto: Record<string, number> = {
      duration_min: Math.round(durationAvg),
      power_w: Math.round(inferredPower),
      ftp_w: Math.round(inferredFtp),
      body_mass_kg: Math.round(bodyMassKg),
      velocity_m_min: 0,
      grade_pct: 0,
      efficiency: 0.24,
      vo2_l_min: Number(vo2ForAuto.toFixed(2)),
      vco2_l_min: Number((vo2ForAuto * rerProxy).toFixed(2)),
      rer: Number(rerProxy.toFixed(2)),
      smo2_rest: Math.round(smo2RestProxy),
      smo2_work: Math.round(smo2WorkProxy),
      lactate_oxidation_pct: 70,
      cori_pct: 18,
      cho_ingested_g_h: 90,
      gut_absorption_pct: 88,
      microbiota_sequestration_pct: 8,
      gut_training_pct: 75,
      candida_overgrowth_pct: 12,
      bifidobacteria_pct: 8,
      akkermansia_pct: 3,
      butyrate_producers_pct: 20,
      endotoxin_risk_pct: 20,
    };

    const autoInputs = {
      source: "executed_workouts_rolling",
      sessionsAnalyzed: executed.length,
      lactate: lactateAuto,
      maxox: {
        vo2_l_min: Number(vo2ForAuto.toFixed(2)),
        body_mass_kg: bodyMassKg,
        power_w: Math.round(inferredPower * 0.8),
        velocity_m_min: 0,
        grade_pct: 0,
        ftp_w: Math.round(inferredFtp),
        efficiency: 0.24,
        rer: Number(rerProxy.toFixed(2)),
        smo2_rest_pct: Math.round(smo2RestProxy),
        smo2_work_pct: Math.round(smo2WorkProxy),
        lactate_mmol_l: Number(avgLactate.toFixed(2)),
        lactate_trend_mmol_h: 2.0,
        hemoglobin_g_dl: 14.5,
        sao2_pct: Math.max(93, Math.min(99, Math.round(96 + (maxHr - restingHrProxy) / 120))),
      },
    };

    const candidaRaw = pickValue(microbiotaValues, [
      "candida_overgrowth_pct",
      "candida_pct",
      "candida_score_0_10",
      "candida_albicans_score_0_10",
    ]);
    const bifidoRaw = pickValue(microbiotaValues, [
      "bifidobacteria_pct",
      "bifidobacterium_pct",
      "bifidobacterium_score_0_10",
      "bifido_score_0_10",
    ]);
    const akkRaw = pickValue(microbiotaValues, [
      "akkermansia_pct",
      "akkermansia_muciniphila_pct",
      "akkermansia_score_0_10",
    ]);
    const butyrateRaw = pickValue(microbiotaValues, [
      "butyrate_producers_pct",
      "butyrate_score_0_10",
      "scfa_butyrate_score_0_10",
    ]);
    const endotoxinRaw = pickValue(microbiotaValues, [
      "endotoxin_risk_pct",
      "lps_risk_pct",
      "leaky_gut_risk_pct",
    ]);
    const zonulinRaw = pickValue(microbiotaValues, ["zonulin_ng_ml"]);

    const candidaPct =
      candidaRaw == null ? null : candidaRaw <= 10 ? candidaRaw * 10 : candidaRaw;
    const bifidoPct =
      bifidoRaw == null ? null : bifidoRaw <= 10 ? bifidoRaw * 10 : bifidoRaw;
    const akkermansiaPct =
      akkRaw == null ? null : akkRaw <= 10 ? akkRaw * 10 : akkRaw;
    const butyratePct =
      butyrateRaw == null ? null : butyrateRaw <= 10 ? butyrateRaw * 10 : butyrateRaw;
    const endotoxinPctFromZonulin =
      zonulinRaw == null ? null : Math.max(0, Math.min(100, ((zonulinRaw - 35) / 35) * 100));
    const endotoxinPct =
      endotoxinRaw == null
        ? endotoxinPctFromZonulin
        : endotoxinRaw <= 10
          ? endotoxinRaw * 10
          : endotoxinRaw;

    const microbiotaProfile =
      candidaPct == null &&
      bifidoPct == null &&
      akkermansiaPct == null &&
      butyratePct == null &&
      endotoxinPct == null
        ? null
        : {
            source: "health_bio_microbiota_panel",
            candida_overgrowth_pct: candidaPct ?? 12,
            bifidobacteria_pct: bifidoPct ?? 8,
            akkermansia_pct: akkermansiaPct ?? 3,
            butyrate_producers_pct: butyratePct ?? 20,
            endotoxin_risk_pct: endotoxinPct ?? 20,
          };

    if (microbiotaProfile) {
      Object.assign(lactateAuto, {
        candida_overgrowth_pct: Number(microbiotaProfile.candida_overgrowth_pct.toFixed(2)),
        bifidobacteria_pct: Number(microbiotaProfile.bifidobacteria_pct.toFixed(2)),
        akkermansia_pct: Number(microbiotaProfile.akkermansia_pct.toFixed(2)),
        butyrate_producers_pct: Number(microbiotaProfile.butyrate_producers_pct.toFixed(2)),
        endotoxin_risk_pct: Number(microbiotaProfile.endotoxin_risk_pct.toFixed(2)),
      });
    }

    const bloodPanel = ((bloodPanelRes.data ?? [])[0] as { values?: Record<string, unknown> | null } | undefined) ?? null;
    const bloodValues = (bloodPanel?.values ?? {}) as Record<string, unknown>;
    const glucoseFromBloodPanel = bloodGlucoseMmolFromPanel(bloodValues);
    const baselineGlucoseMmol = physiologyState.physiologicalProfile.baselineGlucoseMmol ?? null;
    const baselineTempC = physiologyState.physiologicalProfile.baselineTempC ?? null;

    type GlucoseHealthSource = "blood_panel" | "physiological_baseline" | "session_roll";
    let healthBioGlucose: { mmol_l: number; source: GlucoseHealthSource } | null = null;
    if (glucoseFromBloodPanel != null) {
      healthBioGlucose = { mmol_l: glucoseFromBloodPanel, source: "blood_panel" };
    } else if (baselineGlucoseMmol != null && baselineGlucoseMmol >= 2 && baselineGlucoseMmol <= 15) {
      healthBioGlucose = { mmol_l: baselineGlucoseMmol, source: "physiological_baseline" };
    } else if (avgGlucoseSessions != null) {
      healthBioGlucose = { mmol_l: avgGlucoseSessions, source: "session_roll" };
    }

    if (healthBioGlucose != null) {
      lactateAuto.glucose_mmol_l = Number(healthBioGlucose.mmol_l.toFixed(2));
    }

    const healthBioCoreTempC =
      baselineTempC != null && Number.isFinite(baselineTempC) && baselineTempC >= 35 && baselineTempC <= 41.5
        ? Number(baselineTempC.toFixed(2))
        : null;
    if (healthBioCoreTempC != null) {
      lactateAuto.core_temp_c = healthBioCoreTempC;
    }

    const workouts = executed.map((row, idx) => {
      const trace = row.trace_summary ?? {};
      const powerW =
        fromTrace(trace, ["power_avg_w", "avg_power_w", "avg_power", "mean_power_w", "mean_power"]) ??
        fromTrace(trace, ["power_norm_w", "normalized_power_w"]);
      const speedMs =
        fromTrace(trace, ["speed_avg_m_s", "velocity_m_s", "avg_speed_m_s", "speed_m_s"]) ??
        (() => {
          const kmh = fromTrace(trace, ["speed_avg_kmh", "avg_speed_kmh", "velocity_kmh"]);
          return kmh != null ? kmh / 3.6 : null;
        })();
      const gradePct = fromTrace(trace, ["grade_pct", "avg_grade_pct", "slope_pct"]);
      const elevGainM = fromTrace(trace, ["elevation_gain_m", "elev_gain_m", "ascent_m"]);
      const coreTempC = fromTrace(trace, ["core_temp_c", "core_temp", "temperature_core_c"]);
      const skinTempC = fromTrace(trace, ["skin_temp_c", "temperature_c"]);
      const rer =
        fromTrace(trace, ["rer", "vco2_vo2"]) ??
        (() => {
          const vo2 = fromTrace(trace, ["vo2_l_min", "vo2"]);
          const vco2 = fromTrace(trace, ["vco2_l_min", "vco2"]);
          return vo2 != null && vo2 > 0 && vco2 != null ? vco2 / vo2 : null;
        })();
      const vo2FromDevice = fromTrace(trace, ["vo2_l_min", "vo2"]);
      const vco2FromDevice = fromTrace(trace, ["vco2_l_min", "vco2"]);
      const smO2 =
        asNum(row.smo2) ??
        fromTrace(trace, ["smo2", "smo2_avg_pct", "muscle_oxygen_pct"]);
      const lactate =
        asNum(row.lactate_mmoll) ??
        fromTrace(trace, ["lactate_mmoll", "lactate_mmol_l"]);
      const glucose =
        asNum(row.glucose_mmol) ??
        fromTrace(trace, ["glucose_mmol", "blood_glucose_mmol_l"]);
      const workoutSport = fromTraceText(trace, ["sport", "activity_type", "type"]) ?? "cycling";

      return {
        id: row.id ?? `${idx}-${fromTraceText(trace, ["fit_file_id", "session_id"]) ?? "row"}`,
        date: row.date ?? (trace as { date?: string }).date ?? "",
        duration_min: Math.max(0, Number(row.duration_minutes ?? 0)),
        tss: Math.max(0, Number(row.tss ?? 0)),
        sport: workoutSport.toLowerCase(),
        power_w: powerW,
        velocity_m_min: speedMs != null ? speedMs * 60 : null,
        grade_pct: gradePct,
        elevation_gain_m: elevGainM,
        core_temp_c: coreTempC,
        skin_temp_c: skinTempC,
        rer,
        vo2_l_min: vo2FromDevice,
        vco2_l_min: vco2FromDevice,
        smo2: smO2,
        lactate_mmol_l: lactate,
        glucose_mmol_l: glucose,
      };
    });

    return NextResponse.json({
      history: historyRes.data ?? [],
      ftpW: Number.isFinite(ftp) && ftp > 0 ? ftp : null,
      profileVo2maxMlMinKg: vo2maxMlMinKgCanon,
      profileVo2maxLMin: vo2FromProfileLMin,
      autoInputs,
      microbiotaProfile,
      healthBioGlucose,
      healthBioCoreTempC,
      workouts,
    });
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Physiology history fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

