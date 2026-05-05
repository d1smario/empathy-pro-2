import { NextRequest, NextResponse } from "next/server";
import { buildAdaptationGuidance } from "@/lib/adaptation/adaptation-guidance";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { summarizeReadSpineCoverage } from "@/lib/platform/read-spine-coverage";
import { resolveLatestRecoverySummary } from "@/lib/reality/recovery-summary";
import { computeDailyLoadSeries, type ExecutedWorkoutLoadRow } from "@/lib/training/analytics/load-series";
import {
  rollupExecutedVolumeFromLoadRows,
  rollupRecoveryContinuousFromLoadRows,
} from "@/lib/training/analytics/trace-volume-rollup";
import { buildTrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import { resolveAdaptationRegenerationLoop } from "@/lib/training/adaptation-regeneration-loop";
import { buildBioenergeticModulation } from "@/lib/training/bioenergetic-modulation";
import { extractDiaryAdaptiveSignals } from "@/lib/nutrition/diary-adaptive-signals";
import { buildNutritionPerformanceIntegration } from "@/lib/nutrition/performance-integration-scaler";
import { buildOperationalDynamicsLines } from "@/lib/platform/operational-dynamics-lines";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

type PlannedWorkoutAnalyticsRow = {
  date: string | null;
  tss_target: number | null;
  duration_minutes: number | null;
  kcal_target: number | null;
  type: string | null;
};

type DeviceSyncAnalyticsRow = {
  date: string;
  trace_summary: Record<string, unknown>;
};

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readNumFromObject(obj: Record<string, unknown> | null, keys: string[]): number | null {
  if (!obj) return null;
  for (const key of keys) {
    const n = asNumber(obj[key]);
    if (n != null) return n;
  }
  return null;
}

function readDateFromPayload(payload: Record<string, unknown>): string | null {
  const direct = payload.date ?? payload.summary_date ?? payload.source_date;
  if (typeof direct === "string" && /^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  return null;
}

function mergeTrace(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  return { ...base, ...patch };
}

function normalizedTraceFromDeviceExport(payload: Record<string, unknown>): DeviceSyncAnalyticsRow | null {
  const sourcePayload = asRecord(payload.sourcePayload);
  const ingestion = asRecord(payload.realityIngestion);
  const canonicalPreview = asRecord(ingestion?.canonicalPreview);
  const merged = { ...(sourcePayload ?? {}), ...(canonicalPreview ?? {}) };
  const date = readDateFromPayload(merged);
  if (!date) return null;

  const sleepHours =
    readNumFromObject(merged, ["sleep_hours", "total_sleep_hours", "sleep_duration_hours"]) ??
    (() => {
      const mins = readNumFromObject(merged, ["total_sleep_minutes", "sleep_duration_minutes"]);
      return mins != null && mins > 0 ? mins / 60 : null;
    })();

  const normalized: Record<string, unknown> = {};
  const restingHr = readNumFromObject(merged, ["resting_hr_bpm", "resting_heart_rate", "night_hr_bpm"]);
  const hrv = readNumFromObject(merged, ["hrv_rmssd_ms", "hrv_ms", "rmssd"]);
  const deepSleep = readNumFromObject(merged, ["sleep_deep_hours", "deep_sleep_hours"]);
  const remSleep = readNumFromObject(merged, ["sleep_rem_hours", "rem_sleep_hours"]);
  const lightSleep = readNumFromObject(merged, ["sleep_light_hours", "light_sleep_hours"]);
  const skinTemp = readNumFromObject(merged, ["skin_temp_c", "skin_temp_celsius", "temperature_avg_c"]);
  const glucoseMmol = readNumFromObject(merged, ["glucose_mmol_l_avg", "glucose_mmol_l", "glucose_mmol"]);
  const glucoseTir = readNumFromObject(merged, ["time_in_range_pct", "glucose_tir_pct"]);
  const glucoseCv = readNumFromObject(merged, ["glucose_variability_cv", "glucose_cv_pct"]);

  if (sleepHours != null) normalized.sleep_hours = sleepHours;
  if (deepSleep != null) normalized.sleep_deep_hours = deepSleep;
  if (remSleep != null) normalized.sleep_rem_hours = remSleep;
  if (lightSleep != null) normalized.sleep_light_hours = lightSleep;
  if (restingHr != null) normalized.resting_hr_bpm = restingHr;
  if (hrv != null) normalized.hrv_rmssd_ms = hrv;
  if (skinTemp != null) normalized.skin_temp_celsius = skinTemp;
  if (glucoseMmol != null) normalized.glucose_mmol_l = glucoseMmol;
  if (glucoseTir != null) normalized.time_in_range_pct = glucoseTir;
  if (glucoseCv != null) normalized.glucose_variability_cv = glucoseCv;

  return { date, trace_summary: normalized };
}

function biomarkerTrace(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const mappings: Array<[string, string[]]> = [
    ["vo2_l_min", ["vo2_l_min", "vo2_l_min_lab", "vo2_lpm"]],
    ["vco2_l_min", ["vco2_l_min", "vco2_l_min_lab", "vco2_lpm"]],
    ["glucose_mmol_l", ["glucose_mmol_l", "glucose_mmol"]],
    ["testosterone_ng_dl", ["testosterone_ng_dl", "testosterone"]],
    ["nitric_oxide_index", ["nitric_oxide_index", "no_index", "nitric_oxide"]],
    ["lactate_mmol_l", ["lactate_mmol_l", "lactate_mmoll"]],
    ["nad_index", ["nad_index", "nad", "nad_plus"]],
    ["cortisol_ug_dl", ["cortisol_ug_dl", "cortisol"]],
    ["dhea_s_ug_dl", ["dhea_s_ug_dl", "dhea_s", "dhea"]],
  ];
  for (const [target, keys] of mappings) {
    const n = readNumFromObject(values, keys);
    if (n != null) out[target] = n;
  }
  return out;
}

function summarizeWindow(series: ReturnType<typeof computeDailyLoadSeries>, windowSize: number) {
  const window = series.slice(-windowSize);
  const external = window.reduce((sum, day) => sum + day.external, 0);
  const internal = window.reduce((sum, day) => sum + day.internal, 0);
  const coupling = external > 0 ? internal / external : 0;
  return { external, internal, coupling };
}

function summarizePlanWindow(
  compareSeries: Array<{
    planned: number;
    executed: number;
    internal: number;
  }>,
  windowSize: number,
) {
  const n = Number.isFinite(windowSize) ? Math.floor(windowSize) : 0;
  const window =
    compareSeries.length === 0 || n <= 0 ? [] : n >= compareSeries.length ? compareSeries : compareSeries.slice(-n);
  const planned = window.reduce((sum, day) => sum + day.planned, 0);
  const executed = window.reduce((sum, day) => sum + day.executed, 0);
  const internal = window.reduce((sum, day) => sum + day.internal, 0);
  const compliancePct = planned > 0 ? (executed / planned) * 100 : executed > 0 ? 100 : 0;
  const internalVsExecuted = executed > 0 ? internal / executed : 0;
  return {
    planned,
    executed,
    internal,
    delta: executed - planned,
    compliancePct,
    internalVsExecuted,
  };
}

function buildCompareSeries(
  from: string,
  to: string,
  plannedRows: PlannedWorkoutAnalyticsRow[],
  loadSeries: ReturnType<typeof computeDailyLoadSeries>,
) {
  const plannedByDate = new Map<string, number>();
  for (const row of plannedRows) {
    if (!row.date) continue;
    plannedByDate.set(row.date, (plannedByDate.get(row.date) ?? 0) + Math.max(0, Number(row.tss_target ?? 0)));
  }

  const executedByDate = new Map(loadSeries.map((day) => [day.date, day]));
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const out: Array<{
    date: string;
    planned: number;
    executed: number;
    internal: number;
    ctl: number;
    atl: number;
    tsb: number;
    iCtl: number;
    iAtl: number;
    iTsb: number;
    executionVsPlanPct: number;
  }> = [];

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = toDateOnly(cursor);
    const executed = executedByDate.get(date);
    const planned = plannedByDate.get(date) ?? 0;
    const executedExternal = executed?.external ?? 0;
    out.push({
      date,
      planned,
      executed: executedExternal,
      internal: executed?.internal ?? 0,
      ctl: executed?.ctl ?? 0,
      atl: executed?.atl ?? 0,
      tsb: executed?.tsb ?? 0,
      iCtl: executed?.iCtl ?? 0,
      iAtl: executed?.iAtl ?? 0,
      iTsb: executed?.iTsb ?? 0,
      executionVsPlanPct: planned > 0 ? (executedExternal / planned) * 100 : executedExternal > 0 ? 100 : 0,
    });
  }

  return out;
}

export async function GET(req: NextRequest) {
  try {
    const athleteId = (req.nextUrl.searchParams.get("athleteId") ?? "").trim();
    const from = (req.nextUrl.searchParams.get("from") ?? "").trim();
    const to = (req.nextUrl.searchParams.get("to") ?? "").trim();
    if (!athleteId || !from || !to) {
      return NextResponse.json({ error: "Missing athleteId/from/to", rows: [] }, { status: 400, headers: NO_STORE });
    }
    const { db } = await requireAthleteReadContext(req, athleteId);

    const [
      { data: executedData, error: executedError },
      { data: plannedData, error: plannedError },
      { data: deviceExportsData, error: deviceExportsError },
      { data: biomarkerData, error: biomarkerError },
      athleteMemory,
    ] = await Promise.all([
      db
        .from("executed_workouts")
        .select("id, date, tss, duration_minutes, kcal, trace_summary, lactate_mmoll, glucose_mmol, smo2")
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),
      db
        .from("planned_workouts")
        .select("date, tss_target, duration_minutes, kcal_target, type")
        .eq("athlete_id", athleteId)
        .gte("date", from)
        .lte("date", to)
        .order("date", { ascending: true }),
      db
        .from("device_sync_exports")
        .select("provider, payload, created_at")
        .eq("athlete_id", athleteId)
        .in("provider", ["whoop", "cgm"])
        .gte("created_at", `${from}T00:00:00.000Z`)
        .lte("created_at", `${to}T23:59:59.999Z`)
        .order("created_at", { ascending: true }),
      db
        .from("biomarker_panels")
        .select("type, sample_date, created_at, values")
        .eq("athlete_id", athleteId)
        .gte("sample_date", from)
        .lte("sample_date", to)
        .order("sample_date", { ascending: true }),
      resolveAthleteMemory(athleteId),
    ]);

    const error = executedError?.message ?? plannedError?.message ?? deviceExportsError?.message ?? biomarkerError?.message ?? null;
    if (error) return NextResponse.json({ error, rows: [] }, { status: 500, headers: NO_STORE });
    const rows = (executedData ?? []) as Array<Record<string, unknown>>;
    const rowsByDate = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const date = typeof row.date === "string" ? row.date : "";
      if (!date) continue;
      rowsByDate.set(date, row);
    }

    const deviceRows = ((deviceExportsData ?? []) as Array<Record<string, unknown>>)
      .map((row) => normalizedTraceFromDeviceExport(asRecord(row.payload) ?? {}))
      .filter((row): row is DeviceSyncAnalyticsRow => row != null);
    for (const dRow of deviceRows) {
      const existing = rowsByDate.get(dRow.date);
      if (existing) {
        const existingTrace = asRecord(existing.trace_summary) ?? {};
        existing.trace_summary = mergeTrace(existingTrace, dRow.trace_summary);
      } else {
        rowsByDate.set(dRow.date, {
          id: `device-${dRow.date}`,
          date: dRow.date,
          tss: 0,
          duration_minutes: 0,
          kcal: 0,
          trace_summary: dRow.trace_summary,
          lactate_mmoll: null,
          glucose_mmol: null,
          smo2: null,
        });
      }
    }

    const biomarkerRows = ((biomarkerData ?? []) as Array<Record<string, unknown>>)
      .map((row) => {
        const date =
          (typeof row.sample_date === "string" && row.sample_date) ||
          (typeof row.created_at === "string" ? row.created_at.slice(0, 10) : "");
        const trace = biomarkerTrace(asRecord(row.values) ?? {});
        return date && Object.keys(trace).length ? { date, trace } : null;
      })
      .filter((row): row is { date: string; trace: Record<string, unknown> } => row != null);
    for (const bRow of biomarkerRows) {
      const existing = rowsByDate.get(bRow.date);
      if (existing) {
        const existingTrace = asRecord(existing.trace_summary) ?? {};
        existing.trace_summary = mergeTrace(existingTrace, bRow.trace);
      } else {
        rowsByDate.set(bRow.date, {
          id: `biomarker-${bRow.date}`,
          date: bRow.date,
          tss: 0,
          duration_minutes: 0,
          kcal: 0,
          trace_summary: bRow.trace,
          lactate_mmoll: null,
          glucose_mmol: null,
          smo2: null,
        });
      }
    }

    const enrichedRows = Array.from(rowsByDate.values()).sort((a, b) => {
      const da = typeof a.date === "string" ? a.date : "";
      const dbb = typeof b.date === "string" ? b.date : "";
      return da < dbb ? -1 : 1;
    });
    const plannedRows = (plannedData ?? []) as PlannedWorkoutAnalyticsRow[];
    const series = computeDailyLoadSeries(rows as ExecutedWorkoutLoadRow[]);
    const compareSeries = buildCompareSeries(from, to, plannedRows, series);
    const latest = series.at(-1) ?? null;
    const twinState = athleteMemory.twin;
    const readSpineCoverage = summarizeReadSpineCoverage(athleteMemory);
    const last7 = summarizeWindow(series, 7);
    const last28 = summarizeWindow(series, 28);
    const planLast7 = summarizePlanWindow(compareSeries, 7);
    const planLast28 = summarizePlanWindow(compareSeries, 28);
    const planLast90 = summarizePlanWindow(compareSeries, Math.min(90, compareSeries.length));
    const planFullRange = summarizePlanWindow(compareSeries, compareSeries.length);
    const executedVolumeRollup = rollupExecutedVolumeFromLoadRows(rows as ExecutedWorkoutLoadRow[]);
    const recoveryContinuousRollup = rollupRecoveryContinuousFromLoadRows(enrichedRows as ExecutedWorkoutLoadRow[]);
    let recoverySummary: Awaited<ReturnType<typeof resolveLatestRecoverySummary>> = null;
    try {
      recoverySummary = await resolveLatestRecoverySummary(athleteId);
    } catch {
      recoverySummary = null;
    }
    const adaptationGuidance = buildAdaptationGuidance({
      expectedAdaptation: twinState?.expectedAdaptation ?? twinState?.adaptationScore ?? 0,
      observedAdaptation: twinState?.realAdaptation ?? twinState?.adaptationScore ?? 0,
      likelyDrivers: twinState?.likelyDrivers ?? [],
    });
    const operationalContext = buildTrainingDayOperationalContext({
      recoveryStatus: recoverySummary?.status ?? "unknown",
      trafficLight: adaptationGuidance.trafficLight,
      keepProgramUnchanged: adaptationGuidance.keepProgramUnchanged,
      reductionMinPct: adaptationGuidance.reductionMinPct,
      reductionMaxPct: adaptationGuidance.reductionMaxPct,
    });
    const adaptationLoop = await resolveAdaptationRegenerationLoop({
      athleteId,
      twinState,
      recoverySummary,
      operationalContext,
    });
    const bioenergeticModulation =
      athleteMemory.physiology && twinState
        ? buildBioenergeticModulation({
            physiologyState: athleteMemory.physiology,
            twinState,
            recoverySummary,
          })
        : null;

    const diarySignals = extractDiaryAdaptiveSignals({
      profile: athleteMemory.profile,
      diaryEntries: athleteMemory.nutrition.diary ?? [],
    });
    const nutritionPerformanceIntegration = buildNutritionPerformanceIntegration({
      bioenergeticModulation,
      adaptationGuidance,
      adaptationLoop: adaptationLoop ? { status: adaptationLoop.status, nextAction: adaptationLoop.nextAction } : null,
      operationalContext,
      diarySignals,
    });
    const crossModuleDynamicsLines = buildOperationalDynamicsLines({
      adaptationGuidance,
      operationalContext,
      nutritionPerformanceIntegration,
      adaptationLoop: adaptationLoop ? { status: adaptationLoop.status, nextAction: adaptationLoop.nextAction } : null,
    });

    return NextResponse.json(
      {
        athleteId,
        from,
        to,
        rows: enrichedRows,
        plannedRows,
        series,
        compareSeries,
        latest,
        windows: {
          last7,
          last28,
          couplingDelta: last7.coupling - last28.coupling,
        },
        planWindows: {
          last7: planLast7,
          last28: planLast28,
          last90: planLast90,
          fullRange: planFullRange,
        },
        executedVolumeRollup,
        recoveryContinuousRollup,
        adaptationLoop,
        twinState,
        athleteMemory,
        recoverySummary,
        operationalContext,
        bioenergeticModulation,
        adaptationGuidance,
        nutritionPerformanceIntegration,
        crossModuleDynamicsLines,
        readSpineCoverage,
        source: "analytics_v3_planned_real_internal_external",
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      return NextResponse.json({ error: err.message, rows: [] }, { status: err.status, headers: NO_STORE });
    }
    const message = err instanceof Error ? err.message : "Training analytics API error";
    return NextResponse.json({ error: message, rows: [] }, { status: 500, headers: NO_STORE });
  }
}
