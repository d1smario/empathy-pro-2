"use client";

import type { ExecutedWorkout, PlannedWorkout } from "@empathy/domain-training";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  buildDownsampleIndices,
  buildSyntheticRoute,
  computeFitQuality,
  deriveSpeedKmh,
  formatElapsedLabel,
  mergeTraceChannelAvailability,
  pickPrimaryExecutedWorkout,
  n,
  parseRoute,
  pickMetric,
  pickRouteElevationSeries,
  pickSeries,
  pickText,
  prepareAltitudeSeries,
  prepareDisplaySeries,
  resampleToLength,
  routeDistanceKm,
  sanitizeAltitudeForPlot,
  sanitizeSeriesForPlot,
  traceRecord,
} from "@/lib/training/calendar-analyzer-helpers";
import { TrainingCalendarTelemetryChart } from "@/components/training/TrainingCalendarTelemetryChart";
import { TrainingPowerProfileRadar } from "@/components/training/TrainingPowerProfileRadar";
import { resolveExecutedTrainingLoad } from "@/lib/training/infer-executed-training-load";
import {
  resolveExecutedAvgPowerW,
  resolveExecutedKcal,
} from "@/lib/training/resolve-executed-session-energy";
import {
  sessionAverageVamMh,
  sessionPeakVam,
} from "@/lib/training/vam-from-trace";
import { buildAllSessionPeakAnalysisProfiles } from "@/lib/training/analytics/session-peak-analysis";
import { deleteExecutedWorkout } from "@/modules/training/services/training-executed-api";
import { deletePlannedWorkout } from "@/modules/training/services/training-planned-api";
import { Pro2GymSchedaBlockList } from "@/components/training/Pro2GymSchedaBlockList";
import {
  effectiveDurationMinutesFromPro2Contract,
  effectiveTssDisplayFromPro2Contract,
  parsePro2BuilderSessionFromNotes,
} from "@/lib/training/builder/pro2-session-notes";

const StravaStyleMap = dynamic(
  () => import("@/components/training/StravaStyleMap").then((m) => m.StravaStyleMap),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-6 text-center text-sm text-slate-400">
        Mappa percorso…
      </div>
    ),
  },
);

type SessionMetric = {
  tss: number | null;
  duration: number | null;
  km: number | null;
  powerAvg: number | null;
  hrAvg: number | null;
  cadence: number | null;
  speedAvg: number | null;
  altitude: number | null;
  temperature: number | null;
  lactate: number | null;
  glucose: number | null;
  smo2: number | null;
  kcal: number | null;
  kj: number | null;
};

type Props = {
  selectedDate: string;
  dayPlanned: PlannedWorkout[];
  dayExecuted: ExecutedWorkout[];
  /** Eseguiti nel mese visibile: picchi MMP per radar vs massimi storici di finestra. */
  monthExecuted?: ExecutedWorkout[];
  /** Per cancellazione eseguiti (API V1-parity). */
  athleteId?: string | null;
  onExecutedChanged?: () => void;
  onPlannedChanged?: (removedPlannedId?: string) => void;
};

export function TrainingCalendarAnalyzer({
  selectedDate,
  dayPlanned,
  dayExecuted,
  monthExecuted = [],
  athleteId = null,
  onExecutedChanged,
  onPlannedChanged,
}: Props) {
  const [fileTraceMode, setFileTraceMode] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [overlayOn, setOverlayOn] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingPlannedId, setDeletingPlannedId] = useState<string | null>(null);

  const primaryExecuted = useMemo(() => pickPrimaryExecutedWorkout(dayExecuted), [dayExecuted]);

  const dayMetrics = useMemo<SessionMetric[]>(() => {
    return dayExecuted.map((w) => {
      const tr = traceRecord(w);
      return {
        tss: n(w.tss),
        duration: n(w.durationMinutes),
        km: pickMetric(tr, ["distance_km", "distanceKm", "km"]),
        powerAvg: pickMetric(tr, ["power_avg_w", "power_avg", "avg_power", "powerAvg"]),
        hrAvg: pickMetric(tr, ["hr_avg_bpm", "heart_rate_avg", "avg_hr", "hrAvg"]),
        cadence: pickMetric(tr, [
          "cadence_avg_rpm",
          "avg_cadence_rpm",
          "cadence_avg_spm",
          "avg_stride_rate_spm",
          "stroke_rate_avg_spm",
          "avg_stroke_rate",
          "cadence",
        ]),
        speedAvg:
          pickMetric(tr, ["speed_avg_kmh", "avg_speed_kmh", "speedAvg"]) ??
          deriveSpeedKmh(pickMetric(tr, ["distance_km", "distanceKm", "km"]), n(w.durationMinutes)),
        altitude: pickMetric(tr, ["elevation_gain_m", "altitude_gain_m", "elev_gain", "elevationGain"]),
        temperature: pickMetric(tr, ["temperature_avg_c", "temp_avg_c", "temperature"]),
        lactate: n(w.lactateMmoll),
        glucose: n(w.glucoseMmol),
        smo2: n(w.smo2),
        kcal: n(w.kcal),
        kj: n(w.kj),
      };
    });
  }, [dayExecuted]);

  const detailedSeries = useMemo(() => {
    if (!fileTraceMode || !primaryExecuted) return null;
    const tr = traceRecord(primaryExecuted);
    if (!tr) return null;
    const routeAltitudeFromTrack = pickRouteElevationSeries(tr);
    const best = {
      workout: primaryExecuted,
      power: pickSeries(tr, ["power_series_w", "power_stream_w", "power_series"]),
      speed: pickSeries(tr, ["speed_series_kmh", "speed_stream_kmh", "speed_series"]),
      hr: pickSeries(tr, [
        "hr_series_bpm",
        "heart_rate_series_bpm",
        "heart_rate_series",
        "hr_stream_bpm",
        "hr_series",
      ]),
      cadence: pickSeries(tr, ["cadence_series_rpm", "cadence_series"]),
      altitude:
        routeAltitudeFromTrack.length >= 8
          ? routeAltitudeFromTrack
          : pickSeries(tr, [
              "route_altitude_series_m",
              "altitude_series_m",
              "elevation_series_m",
              "altitude_series",
            ]),
      temperature: pickSeries(tr, ["temperature_series_c", "temp_series_c"]),
      coreTemp: pickSeries(tr, ["core_temp_series_c", "core_temperature_series_c"]),
      lactate: pickSeries(tr, ["lactate_series_mmol_l", "lactate_series"]),
      glucose: pickSeries(tr, ["glucose_series_mmol_l", "glucose_series"]),
      smo2: pickSeries(tr, ["smo2_series_pct", "smo2_series"]),
      vo2: pickSeries(tr, ["vo2_series_ml_kg_min", "vo2_series_l_min", "vo2_series", "oxygen_uptake_series"]),
      vco2: pickSeries(tr, ["vco2_series", "vco2_series_l_min", "co2_output_series"]),
    };
    const length = Math.max(
      best.power.length,
      best.speed.length,
      best.hr.length,
      best.cadence.length,
      best.altitude.length,
      best.vo2.length,
      best.vco2.length,
    );
    if (length < 2) return null;
    const fallbackConst = (value: number | null) => Array.from({ length }, () => (value != null ? value : 0));
    const alignOrFallback = (
      arr: number[],
      fallbackValue: number | null,
      opts: { zeroThreshold: number; maxGapLen: number; smoothWindow: number },
    ) =>
      arr.length ? prepareDisplaySeries(resampleToLength(arr, length), opts) : fallbackConst(fallbackValue);
    const hrAvg = pickMetric(tr, ["hr_avg_bpm", "heart_rate_avg", "avg_hr", "hrAvg"]);
    const speedAvg =
      pickMetric(tr, ["speed_avg_kmh", "avg_speed_kmh", "speedAvg"]) ??
      deriveSpeedKmh(
        pickMetric(tr, ["distance_km", "distanceKm", "km"]),
        n(best.workout.durationMinutes),
      );
    const cadenceAvg = pickMetric(tr, ["cadence_avg_rpm", "avg_cadence_rpm", "cadence"]);
    const powerAvg = pickMetric(tr, ["power_avg_w", "power_avg", "avg_power", "powerAvg"]);
    const altitudeAvg = pickMetric(tr, ["altitude_avg_m", "altitude_m"]);
    const altitudeGain = pickMetric(tr, ["elevation_gain_m", "altitude_gain_m", "elev_gain"]);
    const altitudeRamp =
      altitudeAvg == null && altitudeGain != null
        ? Array.from({ length }, (_, i) => (i / Math.max(1, length - 1)) * altitudeGain)
        : null;
    const sessionTss = n(best.workout.tss) ?? 0;
    return {
      length,
      tss: Array.from({ length }, () => sessionTss),
      power: alignOrFallback(best.power, powerAvg, { zeroThreshold: 1, maxGapLen: 6, smoothWindow: 5 }),
      hr: alignOrFallback(best.hr, hrAvg, { zeroThreshold: 1, maxGapLen: 10, smoothWindow: 7 }),
      cadence: alignOrFallback(best.cadence, cadenceAvg, { zeroThreshold: 1, maxGapLen: 6, smoothWindow: 5 }),
      speed: alignOrFallback(best.speed, speedAvg, { zeroThreshold: 0.2, maxGapLen: 8, smoothWindow: 5 }),
      altitude: best.altitude.length
        ? prepareAltitudeSeries(best.altitude, length)
        : altitudeRamp ?? fallbackConst(altitudeAvg),
      temperature: alignOrFallback(
        best.temperature,
        pickMetric(tr, ["temperature_avg_c", "temp_avg_c", "temperature"]),
        { zeroThreshold: 0.05, maxGapLen: 12, smoothWindow: 7 },
      ),
      coreTemp: alignOrFallback(
        best.coreTemp,
        pickMetric(tr, ["core_temp_c", "core_temperature_c"]),
        { zeroThreshold: 0.05, maxGapLen: 12, smoothWindow: 7 },
      ),
      lactate: alignOrFallback(best.lactate, n(best.workout.lactateMmoll), {
        zeroThreshold: 0.01,
        maxGapLen: 10,
        smoothWindow: 5,
      }),
      glucose: alignOrFallback(best.glucose, n(best.workout.glucoseMmol), {
        zeroThreshold: 0.01,
        maxGapLen: 10,
        smoothWindow: 5,
      }),
      smo2: alignOrFallback(best.smo2, n(best.workout.smo2), {
        zeroThreshold: 0.01,
        maxGapLen: 10,
        smoothWindow: 5,
      }),
      vo2: alignOrFallback(best.vo2, pickMetric(tr, ["vo2_ml_kg_min", "vo2_l_min", "vo2"]), {
        zeroThreshold: 0.01,
        maxGapLen: 10,
        smoothWindow: 5,
      }),
      vco2: alignOrFallback(best.vco2, pickMetric(tr, ["vco2_l_min", "vco2"]), {
        zeroThreshold: 0.01,
        maxGapLen: 10,
        smoothWindow: 5,
      }),
    };
  }, [primaryExecuted, fileTraceMode]);

  const lineSeries = useMemo(() => {
    if (detailedSeries) {
      return {
        tss: detailedSeries.tss,
        power: detailedSeries.power,
        hr: detailedSeries.hr,
        cadence: detailedSeries.cadence,
        speed: detailedSeries.speed,
        altitude: detailedSeries.altitude,
        temperature: detailedSeries.temperature,
        coreTemp: detailedSeries.coreTemp,
        lactate: detailedSeries.lactate,
        glucose: detailedSeries.glucose,
        smo2: detailedSeries.smo2,
        vo2: detailedSeries.vo2,
        vco2: detailedSeries.vco2,
      };
    }
    if (dayPlanned.length > 0) {
      return {
        tss: dayPlanned.map((w) => w.tssTarget),
        power: dayPlanned.map(() => 0),
        hr: dayPlanned.map(() => 0),
        cadence: dayPlanned.map(() => 0),
        speed: dayPlanned.map(() => 0),
        altitude: dayPlanned.map(() => 0),
        temperature: dayPlanned.map(() => 0),
        coreTemp: dayPlanned.map(() => 0),
        lactate: dayPlanned.map(() => 0),
        glucose: dayPlanned.map(() => 0),
        smo2: dayPlanned.map(() => 0),
        vo2: dayPlanned.map(() => 0),
        vco2: dayPlanned.map(() => 0),
      };
    }
    return {
      tss: dayMetrics.map((m) => m.tss ?? 0),
      power: dayMetrics.map((m) => m.powerAvg ?? 0),
      hr: dayMetrics.map((m) => m.hrAvg ?? 0),
      cadence: dayMetrics.map((m) => m.cadence ?? 0),
      speed: dayMetrics.map((m) => m.speedAvg ?? 0),
      altitude: dayMetrics.map((m) => m.altitude ?? 0),
      temperature: dayMetrics.map((m) => m.temperature ?? 0),
      coreTemp: dayExecuted.map((w) => pickMetric(traceRecord(w), ["core_temp_c", "core_temperature_c"]) ?? 0),
      lactate: dayMetrics.map((m) => m.lactate ?? 0),
      glucose: dayMetrics.map((m) => m.glucose ?? 0),
      smo2: dayMetrics.map((m) => m.smo2 ?? 0),
      vo2: dayExecuted.map((w) => pickMetric(traceRecord(w), ["vo2_ml_kg_min", "vo2_l_min", "vo2"]) ?? 0),
      vco2: dayExecuted.map((w) => pickMetric(traceRecord(w), ["vco2_l_min", "vco2"]) ?? 0),
    };
  }, [detailedSeries, dayPlanned, dayMetrics, dayExecuted]);

  const analyzerMetricDefs = useMemo(
    () => [
      { id: "tss", label: "Carico", color: "#c084fc", values: lineSeries.tss },
      { id: "power", label: "Power", color: "#f97316", values: lineSeries.power },
      { id: "hr", label: "HR", color: "#ef4444", values: lineSeries.hr },
      { id: "cadence", label: "Cadence", color: "#a78bfa", values: lineSeries.cadence },
      { id: "speed", label: "Speed", color: "#38bdf8", values: lineSeries.speed },
      { id: "altitude", label: "Altitude", color: "#22d3ee", values: lineSeries.altitude },
      { id: "temperature", label: "Temp", color: "#fb923c", values: lineSeries.temperature },
      { id: "coreTemp", label: "Core Temp", color: "#f97316", values: lineSeries.coreTemp },
      { id: "lactate", label: "Lactate", color: "#d946ef", values: lineSeries.lactate },
      { id: "glucose", label: "Glucose", color: "#10b981", values: lineSeries.glucose },
      { id: "smo2", label: "SmO2", color: "#06b6d4", values: lineSeries.smo2 },
      { id: "vo2", label: "VO2", color: "#4ade80", values: lineSeries.vo2 },
      { id: "vco2", label: "VCO2", color: "#2dd4bf", values: lineSeries.vco2 },
    ],
    [lineSeries],
  );

  const availableAnalyzerMetricDefs = useMemo(
    () =>
      analyzerMetricDefs.filter((metric) =>
        metric.values.some((v) => Number.isFinite(v) && Math.abs(v) > 1e-6),
      ),
    [analyzerMetricDefs],
  );

  useEffect(() => {
    setOverlayOn((prev) => {
      const next = { ...prev };
      for (const m of availableAnalyzerMetricDefs) {
        if (next[m.id] === undefined) next[m.id] = true;
      }
      return next;
    });
  }, [availableAnalyzerMetricDefs]);

  const analyzerLabels = useMemo(() => {
    if (detailedSeries) {
      const durationRef = dayExecuted.length > 0 ? n(dayExecuted[0].durationMinutes) : null;
      return Array.from({ length: detailedSeries.length }, (_, i) =>
        formatElapsedLabel(i, detailedSeries.length, durationRef),
      );
    }
    if (dayPlanned.length > 0) return dayPlanned.map((p) => p.date);
    if (dayExecuted.length > 0) return dayExecuted.map((p) => p.date);
    return lineSeries.power.map(() => selectedDate);
  }, [detailedSeries, dayPlanned, dayExecuted, lineSeries.power, selectedDate]);

  const telemetryRows = useMemo(() => {
    if (!detailedSeries || detailedSeries.length < 2) return [];
    return Array.from({ length: detailedSeries.length }, (_, i) => ({
      t: analyzerLabels[i] ?? `${i}`,
      power: detailedSeries.power[i] ?? 0,
      hr: detailedSeries.hr[i] ?? 0,
      altitude: detailedSeries.altitude[i] ?? 0,
    }));
  }, [detailedSeries, analyzerLabels]);

  const peakRadarProfiles = useMemo(() => {
    if (!primaryExecuted) return [];
    return buildAllSessionPeakAnalysisProfiles(primaryExecuted, monthExecuted);
  }, [primaryExecuted, monthExecuted]);

  const selectedMetricDefs = useMemo(
    () => availableAnalyzerMetricDefs.filter((m) => overlayOn[m.id] !== false),
    [availableAnalyzerMetricDefs, overlayOn],
  );

  const dayRefKpis = useMemo(() => {
    const w = primaryExecuted;
    if (!w) {
      return {
        tss: 0,
        kcal: 0,
        wattAvg: null as number | null,
        totalMin: 0,
        vamAvg: null as number | null,
        vamPeak: null as { label: string; vamMh: number } | null,
        multiSessionDay: false,
        dayTotalMin: 0,
      };
    }
    const tr = traceRecord(w);
    const m = Math.max(0, n(w.durationMinutes) ?? 0);
    const p = resolveExecutedAvgPowerW({
      storedKj: w.kj,
      durationMinutes: m,
      traceSummary: tr,
    });
    const tss = resolveExecutedTrainingLoad({
      storedTss: w.tss,
      durationMinutes: m,
      traceSummary: tr,
      vendorLoad: pickMetric(tr, [
        "training_load",
        "trainingLoad",
        "training_load_score",
        "activity_training_load",
      ]),
    });
    const kcal = resolveExecutedKcal({
      storedKcal: w.kcal,
      storedKj: w.kj,
      durationMinutes: m,
      traceSummary: tr,
      avgPowerW: p,
    });
    const dayTotalMin = dayExecuted.reduce((s, row) => s + Math.max(0, n(row.durationMinutes) ?? 0), 0);
    return {
      tss,
      kcal,
      wattAvg: p,
      totalMin: m,
      vamAvg: sessionAverageVamMh(tr, m),
      vamPeak: sessionPeakVam(tr, m),
      multiSessionDay: dayExecuted.length > 1 && dayTotalMin > m + 1,
      dayTotalMin,
    };
  }, [dayExecuted, primaryExecuted]);

  function formatDayDurationMin(min: number): string {
    if (!Number.isFinite(min) || min <= 0) return "—";
    const h = Math.floor(min / 60);
    const mm = Math.round(min % 60);
    return `${h}h ${mm.toString().padStart(2, "0")}m`;
  }

  const plottedAnalyzer = useMemo(() => {
    let srcLabels = analyzerLabels;
    let srcMetrics = selectedMetricDefs.map((m) => ({ ...m, values: [...m.values] }));
    if (srcLabels.length === 1 && srcMetrics.length > 0) {
      srcLabels = [srcLabels[0], srcLabels[0]];
      srcMetrics = srcMetrics.map((m) => ({
        ...m,
        values: [m.values[0] ?? 0, m.values[0] ?? 0],
      }));
    }
    const count = srcLabels.length;
    const indices = buildDownsampleIndices(count, 1400);
    const labels = indices.map((i) => srcLabels[i] ?? "");
    const metrics = srcMetrics.map((m) => ({
      ...m,
      values: indices.map((i) => m.values[i] ?? 0),
    }));
    return { labels, metrics };
  }, [analyzerLabels, selectedMetricDefs]);

  const analyzerInteractive = useMemo(() => {
    const width = 1600;
    const height = 420;
    const plot = { left: 64, right: 22, top: 20, bottom: 38 };
    const innerW = width - plot.left - plot.right;
    const innerH = height - plot.top - plot.bottom;
    const count = Math.max(1, plottedAnalyzer.labels.length);
    const xAt = (i: number) => plot.left + (i / Math.max(1, count - 1)) * innerW;
    const yAt = (norm: number) => plot.top + (1 - norm) * innerH;

    const lines = plottedAnalyzer.metrics.map((metric) => {
      const cleanValues =
        metric.id === "altitude"
          ? sanitizeAltitudeForPlot(metric.values)
          : sanitizeSeriesForPlot(metric.values);
      const valid = cleanValues.filter((v) => Number.isFinite(v));
      const min = valid.length ? Math.min(...valid) : 0;
      const max = valid.length ? Math.max(...valid) : 1;
      const span = Math.max(1e-6, max - min);
      const points = cleanValues
        .map((v, i) => {
          const norm = Number.isFinite(v) ? (v - min) / span : 0;
          return `${xAt(i)},${yAt(norm)}`;
        })
        .join(" ");
      return { ...metric, points };
    });

    return { width, height, plot, innerW, innerH, xAt, yAt, lines, count };
  }, [plottedAnalyzer]);

  const hoverValues = useMemo(() => {
    if (hoverIdx == null) return [];
    return plottedAnalyzer.metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      color: metric.color,
      value: metric.values[hoverIdx] ?? 0,
    }));
  }, [hoverIdx, plottedAnalyzer]);

  const gpsRoute = useMemo(() => {
    const traced = primaryExecuted ? parseRoute(traceRecord(primaryExecuted)) : [];
    if (traced && traced.length >= 2) return traced;
    const fallbackDistance = Math.max(1, dayMetrics.reduce((s, m) => s + (m.km ?? 0), 0));
    return buildSyntheticRoute(fallbackDistance);
  }, [primaryExecuted, dayMetrics]);

  const gpsStats = useMemo(() => {
    const primaryIdx = primaryExecuted ? dayExecuted.findIndex((w) => w.id === primaryExecuted.id) : 0;
    const pm = dayMetrics[primaryIdx >= 0 ? primaryIdx : 0];
    const importedDistanceKm = pm?.km ?? 0;
    const routeKm = routeDistanceKm(gpsRoute);
    const distanceKm =
      routeKm > 0 && (importedDistanceKm <= 0 || importedDistanceKm > routeKm * 3)
        ? routeKm
        : importedDistanceKm;
    const elevGain = pm?.altitude ?? 0;
    const durationMin = pm?.duration ?? 0;
    const paceMinKm = distanceKm > 0 && durationMin > 0 ? durationMin / distanceKm : 0;
    return { distanceKm, elevGain, durationMin, paceMinKm };
  }, [dayMetrics, dayExecuted, gpsRoute, primaryExecuted]);

  const fitQuality = useMemo(() => {
    const withFitTrace =
      (primaryExecuted && pickText(traceRecord(primaryExecuted), ["source_format"]) === "fit"
        ? primaryExecuted
        : dayExecuted.find((w) => pickText(traceRecord(w), ["source_format"]) === "fit")) ?? null;
    if (!withFitTrace) return null;
    return computeFitQuality(traceRecord(withFitTrace), n(withFitTrace.durationMinutes));
  }, [dayExecuted, primaryExecuted]);

  const channelAvailability = useMemo(() => {
    const w = primaryExecuted ?? dayExecuted[0];
    if (!w) return null;
    const trace = traceRecord(w);
    const merged = mergeTraceChannelAvailability(trace);
    if (!merged) return null;
    return merged as Record<string, unknown>;
  }, [dayExecuted, primaryExecuted]);

  const plannedOnly = dayExecuted.length === 0 && dayPlanned.length > 0;
  const nothingDay = dayExecuted.length === 0 && dayPlanned.length === 0;

  if (nothingDay) {
    return (
      <section className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-black/45 to-black/30 px-4 py-5 shadow-inner shadow-violet-950/15">
        <h3 className="text-base font-bold text-white">
          Analyzer ·{" "}
          {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("it-IT", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </h3>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-400">
          <p className="font-semibold text-slate-200">Nessuna sessione in questo giorno</p>
          <p className="mt-2">
            Seleziona un altro giorno sul calendario oppure aggiungi una pianificazione / importa un file eseguito.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-500/20 bg-gradient-to-b from-black/45 to-black/30 px-4 py-5 shadow-inner shadow-violet-950/20">
      <h3 className="text-base font-bold text-white">
        Analyzer ·{" "}
        {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("it-IT", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </h3>

      {plannedOnly ? (
        <p className="mt-2 rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-sm text-violet-100/90">
          Solo pianificazione: il grafico mostra carico e durata target (blocchi PLAN). Importa un eseguito per mappa e traccia
          file.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <div className="min-w-0 flex-1">
          {plannedOnly ? (
            <div className="flex h-[220px] items-center justify-center rounded-lg border border-white/10 bg-black/40 text-center text-sm text-slate-500">
              Mappa percorso dopo import di un workout eseguito (FIT/GPX/TCX).
            </div>
          ) : (
            <StravaStyleMap route={gpsRoute} height={220} />
          )}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2 text-xs font-semibold text-slate-300 lg:flex-col lg:justify-center">
          <span className="rounded-lg bg-white/5 px-2 py-1">Distanza {gpsStats.distanceKm.toFixed(1)} km</span>
          <span className="rounded-lg bg-white/5 px-2 py-1">Dislivello {gpsStats.elevGain.toFixed(0)} m</span>
          <span className="rounded-lg bg-white/5 px-2 py-1">Durata {gpsStats.durationMin.toFixed(0)} min</span>
          <span className="rounded-lg bg-white/5 px-2 py-1">
            Ritmo {gpsStats.paceMinKm > 0 ? gpsStats.paceMinKm.toFixed(2) : "0.00"} min/km
          </span>
        </div>
      </div>

      {fitQuality ? (
        <details className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-200">
            Qualità file {fitQuality.sourceFormat.toUpperCase()}:{" "}
            <span
              className={
                fitQuality.status === "OK"
                  ? "text-emerald-400"
                  : fitQuality.status === "SPARSE"
                    ? "text-amber-300"
                    : "text-rose-400"
              }
            >
              {fitQuality.status}
            </span>
          </summary>
          <p className="mt-2 text-xs text-slate-400">
            {fitQuality.note} · records: {fitQuality.recordCount} · sessions: {fitQuality.sessionCount}
          </p>
          <p className="text-xs text-slate-400">parser: {fitQuality.parserEngine ?? "—"}</p>
          <p className="text-xs text-slate-400">
            coverage → Power {fitQuality.channelCoveragePct.power}% · HR {fitQuality.channelCoveragePct.hr}% · Speed{" "}
            {fitQuality.channelCoveragePct.speed}% · Cadence {fitQuality.channelCoveragePct.cadence}% · Alt{" "}
            {fitQuality.channelCoveragePct.altitude}%
          </p>
          {fitQuality.sourceFile ? (
            <p className="text-xs text-slate-400">
              source: {fitQuality.sourceFile.slice(0, 70)}
              {fitQuality.sourceFile.length > 70 ? "…" : ""}
            </p>
          ) : null}
        </details>
      ) : null}

      {channelAvailability ? (
        <p className="mt-3 text-xs text-slate-500">
          Canali file:{" "}
          {Object.entries(channelAvailability)
            .map(([k, v]) => `${k}:${v ? "yes" : "no"}`)
            .join(" · ")}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFileTraceMode((v) => !v)}
          disabled={plannedOnly}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
            fileTraceMode
              ? "border-fuchsia-400/45 bg-fuchsia-500/15 text-fuchsia-100"
              : "border-white/15 bg-white/5 text-slate-400"
          } ${plannedOnly ? "cursor-not-allowed opacity-40" : ""}`}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: fileTraceMode ? "#e879f9" : "#64748b" }}
            aria-hidden
          />
          File trace mode
        </button>
        <span className="text-xs text-slate-500">
          Con traccia Garmin/Wahoo: potenza, FC, quota; radar vs picco mese — VAM da quota o vertical_speed (m/h).
        </span>
      </div>

      {!plannedOnly && dayExecuted.length > 0 ? (
        <>
          {dayRefKpis.multiSessionDay ? (
            <p className="mt-3 text-xs text-amber-200/90">
              KPI sulla seduta principale (mappa/GPS). Totale giornata: {formatDayDurationMin(dayRefKpis.dayTotalMin)} su{" "}
              {dayExecuted.length} sessioni.
            </p>
          ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl border border-rose-500/45 bg-rose-500/[0.12] px-4 py-3">
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-rose-200/80">Carico · seduta</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-rose-50">{dayRefKpis.tss.toFixed(0)}</div>
          </div>
          <div className="rounded-2xl border border-amber-500/45 bg-amber-500/[0.12] px-4 py-3">
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-200/80">Kcal · seduta</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-amber-50">{dayRefKpis.kcal.toFixed(0)}</div>
          </div>
          <div className="rounded-2xl border border-sky-500/45 bg-sky-500/[0.12] px-4 py-3">
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-sky-200/80">Watt medi</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-sky-50">
              {dayRefKpis.wattAvg != null ? `${dayRefKpis.wattAvg.toFixed(0)} W` : "—"}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-500/45 bg-emerald-500/[0.12] px-4 py-3">
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-200/80">Durata · seduta</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-emerald-50">
              {formatDayDurationMin(dayRefKpis.totalMin)}
            </div>
          </div>
          <div className="rounded-2xl border border-teal-500/45 bg-teal-500/[0.12] px-4 py-3">
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-teal-200/80">VAM media salita</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-teal-50">
              {dayRefKpis.vamAvg != null ? `${dayRefKpis.vamAvg} m/h` : "—"}
            </div>
            <p className="mt-0.5 text-[0.6rem] text-teal-200/60">dislivello ÷ ore</p>
          </div>
          <div className="rounded-2xl border border-cyan-500/45 bg-cyan-500/[0.12] px-4 py-3">
            <div className="text-[0.65rem] font-bold uppercase tracking-wider text-cyan-200/80">
              VAM max{dayRefKpis.vamPeak ? ` · ${dayRefKpis.vamPeak.label}` : ""}
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-cyan-50">
              {dayRefKpis.vamPeak != null ? `${dayRefKpis.vamPeak.vamMh} m/h` : "—"}
            </div>
            <p className="mt-0.5 text-[0.6rem] text-cyan-200/60">picco finestra</p>
          </div>
        </div>
        </>
      ) : null}

      {telemetryRows.length >= 2 ? (
        <div className="mt-4 rounded-2xl border border-orange-500/25 bg-gradient-to-b from-slate-950/95 via-slate-900/40 to-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <h4 className="text-sm font-bold text-orange-100/95">Telemetria (stile sessione)</h4>
          <p className="mb-3 text-xs text-slate-500">Potenza con riempimento gradiente; FC in rosso; quota separata sotto.</p>
          <TrainingCalendarTelemetryChart data={telemetryRows} />
        </div>
      ) : null}

      {peakRadarProfiles.length > 0 ? (
        <div className="mt-6 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-pink-100/95">Profili · radar vs picco mese</h4>
            <p className="mt-1 text-xs text-slate-500">
              Un esagono per ogni canale presente nella registrazione (potenza, FC, cadenza, velocità, VAM, lattato,
              glucosio, SmO₂, temperatura, VO₂, …) — finestre 5s → 60′ vs picco del mese.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {peakRadarProfiles.map((profile) => (
              <div
                key={profile.metricId}
                className="rounded-2xl border border-pink-500/25 bg-gradient-to-b from-slate-950/95 via-slate-900/40 to-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-200/90">
                  {profile.label} ({profile.unit})
                </h5>
                <TrainingPowerProfileRadar rows={profile.rows} valueUnit={profile.unit} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <details open className="group mt-6 rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-400 group-open:text-slate-300">
          Confronto normalizzato (tutte le metriche sovrapposte)
        </summary>
             <p className="mb-2 mt-2 text-xs text-slate-500">
               Asse Y 0–100%: ogni serie sul proprio min/max. Attiva/disattiva curve (FC, glucosio, core temp, smO2, VO2,
               VCO2, …) per sovrapporle.
             </p>
             <div className="mb-3 flex flex-wrap gap-2">
               <button
                 type="button"
                 className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                 onClick={() => {
                   const o: Record<string, boolean> = {};
                   for (const m of availableAnalyzerMetricDefs) o[m.id] = true;
                   setOverlayOn(o);
                 }}
               >
                 Tutte
               </button>
               <button
                 type="button"
                 className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                 onClick={() => {
                   const next: Record<string, boolean> = {};
                   for (const m of availableAnalyzerMetricDefs) {
                     next[m.id] = ["tss", "power", "hr"].includes(m.id);
                   }
                   setOverlayOn(next);
                 }}
               >
                 Solo carico · Power · HR
               </button>
             </div>
             <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
               {availableAnalyzerMetricDefs.map((m) => (
                 <label
                   key={m.id}
                   className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200"
                 >
                   <input
                     type="checkbox"
                     className="rounded border-white/20 bg-black/40"
                     checked={overlayOn[m.id] !== false}
                     onChange={(e) => setOverlayOn((prev) => ({ ...prev, [m.id]: e.target.checked }))}
                   />
                   <span className="inline-flex items-center gap-1">
                     <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                     {m.label}
                   </span>
                 </label>
               ))}
             </div>
      {selectedMetricDefs.length === 0 ? (
        <p className="text-sm text-amber-200/90">Seleziona almeno una metrica per visualizzare il grafico.</p>
      ) : (
      <svg
        viewBox={`0 0 ${analyzerInteractive.width} ${analyzerInteractive.height}`}
        width="100%"
        height={420}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Grafico analisi metriche allenamento"
        className="mt-1 block max-h-[min(420px,70vw)] min-h-[280px] w-full text-slate-200"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={`grid-${t}`}>
            <line
              x1={analyzerInteractive.plot.left}
              y1={analyzerInteractive.yAt(t)}
              x2={analyzerInteractive.width - analyzerInteractive.plot.right}
              y2={analyzerInteractive.yAt(t)}
              stroke="rgba(255,255,255,0.12)"
            />
            <text x={18} y={analyzerInteractive.yAt(t) + 4} fill="#94a3b8" fontSize="11">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <line
          x1={analyzerInteractive.plot.left}
          y1={analyzerInteractive.plot.top}
          x2={analyzerInteractive.plot.left}
          y2={analyzerInteractive.height - analyzerInteractive.plot.bottom}
          stroke="rgba(255,255,255,0.38)"
        />
        <line
          x1={analyzerInteractive.plot.left}
          y1={analyzerInteractive.height - analyzerInteractive.plot.bottom}
          x2={analyzerInteractive.width - analyzerInteractive.plot.right}
          y2={analyzerInteractive.height - analyzerInteractive.plot.bottom}
          stroke="rgba(255,255,255,0.38)"
        />
        {analyzerInteractive.lines.map((line) => (
          <polyline
            key={line.id}
            fill="none"
            stroke={line.color}
            strokeWidth="2.2"
            points={line.points}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {hoverIdx != null ? (
          <line
            x1={analyzerInteractive.xAt(hoverIdx)}
            y1={analyzerInteractive.plot.top}
            x2={analyzerInteractive.xAt(hoverIdx)}
            y2={analyzerInteractive.height - analyzerInteractive.plot.bottom}
            stroke="#ffffff"
            strokeOpacity={0.4}
            strokeDasharray="4 4"
          />
        ) : null}
        <rect
          x={analyzerInteractive.plot.left}
          y={analyzerInteractive.plot.top}
          width={analyzerInteractive.innerW}
          height={analyzerInteractive.innerH}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
            const relX = e.clientX - rect.left;
            const clamped = Math.max(0, Math.min(rect.width, relX));
            const idx = Math.round(
              (clamped / Math.max(1, rect.width)) * Math.max(0, analyzerInteractive.count - 1),
            );
            setHoverIdx(idx);
          }}
          onMouseLeave={() => setHoverIdx(null)}
        />
        <text x={analyzerInteractive.width - 210} y={analyzerInteractive.height - 8} fill="#94a3b8" fontSize="11">
          Timeline
        </text>
      </svg>
      )}
      </details>

      {hoverIdx != null ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs">
          <strong className="text-slate-200">{plottedAnalyzer.labels[hoverIdx] ?? selectedDate}</strong>
          <div className="mt-1 flex flex-wrap gap-2">
            {hoverValues.map((v) => (
              <span key={v.id} className="text-slate-400">
                <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: v.color }} />
                {v.label}: {Number.isFinite(v.value) ? v.value.toFixed(2) : "0.00"}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 text-sm">
        {dayPlanned.map((w) => {
          const c = parsePro2BuilderSessionFromNotes(w.notes ?? null);
          const dm = effectiveDurationMinutesFromPro2Contract(c, w.durationMinutes);
          const ts = effectiveTssDisplayFromPro2Contract(c, w.tssTarget);
          const isGym = c?.family === "strength";
          return (
            <div
              key={w.id}
              className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded-full border border-violet-400/55 bg-violet-400/15 px-2 py-0.5 text-[0.65rem] font-bold text-violet-100">
                    PLAN
                  </span>
                  <span>
                    {c?.sessionName?.trim() || w.type} · {dm}m · carico {ts}
                  </span>
                </div>
                {athleteId ? (
                  <button
                    type="button"
                    disabled={deletingPlannedId === w.id}
                    className="shrink-0 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2 py-1 text-xs font-bold text-rose-100 hover:bg-rose-500/25 disabled:opacity-40"
                    onClick={async () => {
                      if (!athleteId || !window.confirm("Eliminare questa seduta pianificata?")) return;
                      setDeletingPlannedId(w.id);
                      try {
                        const aid = (w.athleteId?.trim() || athleteId?.trim() || "").trim();
                        if (!aid) {
                          window.alert("Manca athleteId: impossibile allineare DELETE a planned-window.");
                          return;
                        }
                        await deletePlannedWorkout({ id: w.id, athleteId: aid });
                        onPlannedChanged?.(w.id);
                      } catch (err) {
                        window.alert(err instanceof Error ? err.message : "Eliminazione non riuscita");
                      } finally {
                        setDeletingPlannedId(null);
                      }
                    }}
                  >
                    {deletingPlannedId === w.id ? "…" : "Elimina"}
                  </button>
                ) : null}
              </div>
              {isGym && c ? (
                <div className="mt-3 border-t border-violet-400/20 pt-3">
                  <Pro2GymSchedaBlockList contract={c} compact />
                </div>
              ) : null}
            </div>
          );
        })}
        {dayExecuted.map((w) => {
          const tr = traceRecord(w);
          const fn = pickText(tr, ["imported_file_name"]);
          return (
            <div
              key={w.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2"
            >
              <div className="min-w-0">
                <span className="rounded-full border border-sky-400/55 bg-sky-400/15 px-2 py-0.5 text-[0.65rem] font-bold text-sky-100">
                  EXEC
                </span>
                <span className="ml-2">
                  {w.durationMinutes}m · carico {w.tss}
                  {fn ? (
                    <>
                      {" "}
                      · file {fn.slice(0, 36)}
                      {fn.length > 36 ? "…" : ""}
                    </>
                  ) : null}
                </span>
              </div>
              {athleteId ? (
                <button
                  type="button"
                  disabled={deletingId === w.id}
                  className="shrink-0 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2 py-1 text-xs font-bold text-rose-100 hover:bg-rose-500/25 disabled:opacity-40"
                  onClick={async () => {
                    if (
                      !athleteId ||
                      !window.confirm("Eliminare questo workout eseguito? (V1: rimuove anche duplicati stesso import.)")
                    ) {
                      return;
                    }
                    setDeletingId(w.id);
                    try {
                      await deleteExecutedWorkout({
                        id: w.id,
                        athleteId,
                        date: selectedDate,
                        importedFileName: fn ?? undefined,
                      });
                      onExecutedChanged?.();
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : "Eliminazione non riuscita");
                    } finally {
                      setDeletingId(null);
                    }
                  }}
                >
                  {deletingId === w.id ? "…" : "Elimina"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
