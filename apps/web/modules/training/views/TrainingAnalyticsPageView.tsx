"use client";

import type {
  TrainingAdaptationLoopViewModel,
  TrainingBioenergeticModulationViewModel,
} from "@/api/training/contracts";
import { BarChart3, Hexagon, LineChart } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Link } from "@/components/ui/empathy";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { fetchTrainingAnalyticsRows } from "@/modules/training/services/training-analytics-api";
import {
  OVERLAY_METRIC_DEFS,
  type CompareDayRow,
  type ExecutedAnalyticsRow,
  type MetricSeriesKey,
  dailyMetricMap,
  hexWeekCompareFromTimeline,
  normalize01Series,
  refKpisLastNDays,
  valueForMetric,
} from "@/lib/training/analytics/executed-metric-aggregates";

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function polyline(values: number[], width: number, height: number) {
  if (!values.length) return "";
  const max = Math.max(1, ...values);
  return values
    .map((v, i) => {
      const x = 20 + (i / Math.max(1, values.length - 1)) * (width - 40);
      const y = height - 20 - (v / max) * (height - 40);
      return `${x},${y}`;
    })
    .join(" ");
}

function couplingColor(coupling: number): string {
  if (coupling > 1.15) return "#ff5d5d";
  if (coupling < 0.85) return "#ffd60a";
  return "#00e08d";
}

function polylineNormalized(values: number[], width: number, height: number) {
  if (!values.length) return "";
  return values
    .map((v, i) => {
      const x = 20 + (i / Math.max(1, values.length - 1)) * (width - 40);
      const clamped = Math.max(0, Math.min(100, v));
      const y = height - 20 - (clamped / 100) * (height - 40);
      return `${x},${y}`;
    })
    .join(" ");
}

function formatDurationTotal(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function radarRingPoints(values: number[], cx: number, cy: number, maxR: number): string {
  return values
    .map((v, i) => {
      const t = ((-90 + i * 60) * Math.PI) / 180;
      const r = (Math.max(0, Math.min(100, v)) / 100) * maxR;
      return `${cx + r * Math.cos(t)},${cy + r * Math.sin(t)}`;
    })
    .join(" ");
}

/**
 * Analyzer — logica V1 (carico esterno/interno, planned vs real) con shell Pro 2 / Tailwind.
 */
export default function TrainingAnalyticsPageView() {
  const { athleteId, role, loading: athleteLoading } = useActiveAthlete();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [plannedRows, setPlannedRows] = useState<Array<Record<string, unknown>>>([]);
  const [series, setSeries] = useState<
    Array<{
      date: string;
      external: number;
      internal: number;
      ctl: number;
      atl: number;
      tsb: number;
      iCtl: number;
      iAtl: number;
      iTsb: number;
    }>
  >([]);
  const [compareSeries, setCompareSeries] = useState<
    Array<{
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
    }>
  >([]);
  const [latest, setLatest] = useState<{
    date: string;
    external: number;
    internal: number;
    ctl: number;
    atl: number;
    tsb: number;
    iCtl: number;
    iAtl: number;
    iTsb: number;
  } | null>(null);
  const [windows, setWindows] = useState<{
    last7: { external: number; internal: number; coupling: number };
    last28: { external: number; internal: number; coupling: number };
    couplingDelta: number;
  } | null>(null);
  const [planWindows, setPlanWindows] = useState<{
    last7: {
      planned: number;
      executed: number;
      internal: number;
      delta: number;
      compliancePct: number;
      internalVsExecuted: number;
    };
    last28: {
      planned: number;
      executed: number;
      internal: number;
      delta: number;
      compliancePct: number;
      internalVsExecuted: number;
    };
  } | null>(null);
  const [adaptationLoop, setAdaptationLoop] = useState<TrainingAdaptationLoopViewModel | null>(null);
  const [twinState, setTwinState] = useState<{
    readiness?: number;
    fatigueAcute?: number;
    glycogenStatus?: number;
    adaptationScore?: number;
    redoxStressIndex?: number;
    divergenceScore?: number;
    interventionScore?: number;
    loadSnapshot?: { plannedTssNext7d?: number; plannedSessionsNext7d?: number };
  } | null>(null);
  const [recoverySummary, setRecoverySummary] = useState<RecoverySummary | null>(null);
  const [operationalContext, setOperationalContext] = useState<TrainingDayOperationalContext | null>(null);
  const [bioenergeticModulation, setBioenergeticModulation] = useState<TrainingBioenergeticModulationViewModel | null>(null);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [crossModuleDynamicsLines, setCrossModuleDynamicsLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overlayOn, setOverlayOn] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of OVERLAY_METRIC_DEFS) {
      init[d.key] = ["planned", "executed", "internal", "ctl", "iCtl"].includes(d.key);
    }
    return init;
  });
  const [hexMetric, setHexMetric] = useState<MetricSeriesKey>("executed");

  useEffect(() => {
    async function loadExecuted() {
      if (!athleteId) {
        setRows([]);
        setPlannedRows([]);
        setSeries([]);
        setCompareSeries([]);
        setLatest(null);
        setWindows(null);
        setPlanWindows(null);
        setAdaptationLoop(null);
        setTwinState(null);
        setRecoverySummary(null);
        setOperationalContext(null);
        setBioenergeticModulation(null);
        setReadSpineCoverage(null);
        setCrossModuleDynamicsLines([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      const today = new Date();
      const start = new Date(today);
      start.setDate(today.getDate() - 120);
      const payload = await fetchTrainingAnalyticsRows({
        athleteId,
        from: toDateOnly(start),
        to: toDateOnly(today),
      });

      if (payload.error) {
        setError(payload.error);
        setRows([]);
        setPlannedRows([]);
        setSeries([]);
        setCompareSeries([]);
        setLatest(null);
        setWindows(null);
        setPlanWindows(null);
        setAdaptationLoop(null);
        setTwinState(null);
        setRecoverySummary(null);
        setOperationalContext(null);
        setBioenergeticModulation(null);
        setReadSpineCoverage(null);
        setCrossModuleDynamicsLines([]);
      } else {
        setRows(payload.rows ?? []);
        setPlannedRows(payload.plannedRows ?? []);
        setSeries(payload.series ?? []);
        setCompareSeries(payload.compareSeries ?? []);
        setLatest(payload.latest ?? null);
        setWindows(payload.windows ?? null);
        setPlanWindows(payload.planWindows ?? null);
        setAdaptationLoop(payload.adaptationLoop ?? null);
        setTwinState(payload.athleteMemory?.twin ?? payload.twinState ?? null);
        setRecoverySummary(payload.recoverySummary ?? null);
        setOperationalContext(payload.operationalContext ?? null);
        setBioenergeticModulation(payload.bioenergeticModulation ?? null);
        setReadSpineCoverage(payload.readSpineCoverage ?? null);
        setCrossModuleDynamicsLines(payload.crossModuleDynamicsLines ?? []);
      }
      setLoading(false);
    }
    void loadExecuted();
  }, [athleteId]);

  const last42 = series.slice(-42);
  const last42Compare = compareSeries.slice(-42);
  const external7 = windows?.last7.external ?? 0;
  const internal7 = windows?.last7.internal ?? 0;
  const external28 = windows?.last28.external ?? 0;
  const internal28 = windows?.last28.internal ?? 0;
  const coupling7 = windows?.last7.coupling ?? 0;
  const coupling28 = windows?.last28.coupling ?? 0;
  const couplingDelta = windows?.couplingDelta ?? 0;
  const couplingToneClass = coupling7 > 1.15 ? "text-rose-300" : coupling7 < 0.85 ? "text-amber-300" : "text-emerald-300";
  const plan7 = planWindows?.last7;
  const plan28 = planWindows?.last28;
  const compliance7 = plan7?.compliancePct ?? 0;
  const divergenceScore = adaptationLoop?.divergenceScore ?? twinState?.divergenceScore ?? 0;
  const interventionScore = adaptationLoop?.interventionScore ?? twinState?.interventionScore ?? 0;
  const adaptationToneClass =
    divergenceScore > 45 ? "text-rose-300" : divergenceScore > 20 ? "text-amber-300" : "text-emerald-300";

  const adaptationStatus =
    divergenceScore > 45
      ? "High divergence: real load is far from planned load"
      : coupling7 > 1.15
        ? "Warning: internal load high vs external"
        : coupling7 < 0.85
          ? "Low coupling: check underload/context"
          : "Balanced coupling";
  const adaptabilityScore = Math.max(0, Math.min(100, Math.round(100 - divergenceScore * 1.7)));
  const operationalSuggestedLoad7d = useMemo(() => {
    if (!operationalContext) return null;
    return Math.max(0, Math.round((adaptationLoop?.expectedLoad7d ?? 0) * operationalContext.loadScale));
  }, [operationalContext, adaptationLoop?.expectedLoad7d]);

  const dmMap = useMemo(() => dailyMetricMap(rows as ExecutedAnalyticsRow[]), [rows]);
  const analyticsEndDate = compareSeries.at(-1)?.date ?? toDateOnly(new Date());
  const refKpis7d = useMemo(
    () => refKpisLastNDays(rows as ExecutedAnalyticsRow[], 7, analyticsEndDate),
    [rows, analyticsEndDate],
  );

  const toCompareRow = (c: (typeof compareSeries)[number]): CompareDayRow => ({
    date: c.date,
    planned: c.planned,
    executed: c.executed,
    internal: c.internal,
    ctl: c.ctl,
    iCtl: c.iCtl,
  });

  const seriesForMetric = (key: MetricSeriesKey): number[] =>
    last42Compare.map((c) => valueForMetric(key, toCompareRow(c), dmMap, c.date));

  const hexData = useMemo(() => {
    const dates = compareSeries.map((c) => c.date);
    const daily = new Map<string, number>();
    for (const c of compareSeries) {
      daily.set(c.date, valueForMetric(hexMetric, toCompareRow(c), dmMap, c.date));
    }
    return hexWeekCompareFromTimeline(daily, dates);
  }, [compareSeries, dmMap, hexMetric]);

  const hexNorm = useMemo(() => {
    const seq = [...hexData.recent, ...hexData.baseline];
    const n = normalize01Series(seq);
    return { recent: n.slice(0, 6), baseline: n.slice(6, 12) };
  }, [hexData]);

  const plannedPolyline = polyline(last42Compare.map((p) => p.planned), 1100, 260);
  const extPolyline = polyline(last42Compare.map((p) => p.executed), 1100, 260);
  const intPolyline = polyline(last42Compare.map((p) => p.internal), 1100, 260);
  const ctlPolyline = polyline(last42.map((p) => p.ctl), 1100, 260);
  const iCtlPolyline = polyline(last42.map((p) => p.iCtl), 1100, 260);

  const kpiCard = (label: string, value: ReactNode, valueClass = "text-white") => (
    <div className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
      <div className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${valueClass}`}>{value}</div>
    </div>
  );

  return (
    <Pro2ModulePageShell
      eyebrow="Training · Analyzer"
      eyebrowClassName="text-rose-400"
      title="Load intelligence"
      description="External vs internal load, planned vs executed, adaptation loop — stesso endpoint V1 (`/api/training/analytics`)."
      headerActions={
        <>
          <Pro2Link
            href="/training/calendar"
            variant="secondary"
            className="justify-center border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15"
          >
            Calendar
          </Pro2Link>
          <Pro2Link
            href="/training/builder"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Builder
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        <TrainingSubnav />
      </div>

      {readSpineCoverage && athleteId && !error ? (
        <details className="mb-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-300">
          <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-wider text-cyan-300/90">
            Spina lettura (athlete-memory) · {readSpineCoverage.spineScore}%
          </summary>
          <p className="mt-2 text-xs text-slate-500">
            Stesso riepilogo della dashboard hub: copertura aggregata su profilo, fisiologia, twin, nutrizione, health,
            ingest, evidence.
          </p>
        </details>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
          {error}
        </p>
      ) : null}

      {!athleteId && !athleteLoading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-400">
          {role === "coach"
            ? "Imposta atleta attivo dal contesto profilo/coach per analizzare il carico."
            : "Profilo atleta non disponibile."}
        </div>
      ) : loading ? (
        <p className="text-sm text-slate-500">Caricamento…</p>
      ) : !series.length && !plannedRows.length ? (
        <p className="text-sm text-slate-500">Nessun dato planned/executed negli ultimi 120 giorni.</p>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-rose-500/45 bg-rose-500/[0.12] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.2)]">
              <div className="text-[0.65rem] font-bold uppercase tracking-wider text-rose-200/80">TSS · 7g</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-rose-50">{refKpis7d.tss.toFixed(0)}</div>
            </div>
            <div className="rounded-2xl border border-amber-500/45 bg-amber-500/[0.12] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]">
              <div className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-200/80">Kcal · 7g</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-amber-50">{refKpis7d.kcal.toFixed(0)}</div>
            </div>
            <div className="rounded-2xl border border-sky-500/45 bg-sky-500/[0.12] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.2)]">
              <div className="text-[0.65rem] font-bold uppercase tracking-wider text-sky-200/80">Watt medi</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-sky-50">
                {refKpis7d.wattAvg != null ? `${refKpis7d.wattAvg.toFixed(0)} W` : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-500/45 bg-emerald-500/[0.12] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]">
              <div className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-200/80">Tempo tot · 7g</div>
              <div className="mt-1 text-xl font-bold tabular-nums text-emerald-50">
                {formatDurationTotal(refKpis7d.totalMinutes)}
              </div>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kpiCard("External load 7d", external7.toFixed(0))}
            {kpiCard("Internal load 7d", internal7.toFixed(0), "text-fuchsia-200")}
            {kpiCard("Planned / real 7d", plan7 ? `${plan7.planned.toFixed(0)} / ${plan7.executed.toFixed(0)}` : "—")}
            {kpiCard(
              "Execution compliance 7d",
              `${compliance7.toFixed(0)}%`,
              compliance7 < 70 || compliance7 > 130 ? "text-amber-200" : "text-emerald-200",
            )}
            {kpiCard(
              "Coupling 7d",
              <>
                <span style={{ color: couplingColor(coupling7) }}>{coupling7.toFixed(2)}</span>
                <span className="ml-2 text-xs font-normal text-slate-500">
                  Δ28d {couplingDelta >= 0 ? "+" : ""}
                  {couplingDelta.toFixed(2)}
                </span>
              </>,
              couplingToneClass,
            )}
            {kpiCard(
              "CTL / ATL / TSB (ext)",
              latest ? `${latest.ctl.toFixed(1)} / ${latest.atl.toFixed(1)} / ${latest.tsb.toFixed(1)}` : "—",
            )}
            {kpiCard(
              "CTL / ATL / TSB (int)",
              latest ? `${latest.iCtl.toFixed(1)} / ${latest.iAtl.toFixed(1)} / ${latest.iTsb.toFixed(1)}` : "—",
            )}
            {kpiCard(
              "Readiness / fatigue",
              twinState
                ? `${(twinState.readiness ?? 0).toFixed(1)} / ${(twinState.fatigueAcute ?? 0).toFixed(1)}`
                : "—",
            )}
            {kpiCard(
              "Glycogen / adaptation",
              twinState
                ? `${(twinState.glycogenStatus ?? 0).toFixed(1)} / ${(twinState.adaptationScore ?? 0).toFixed(1)}`
                : "—",
            )}
            {kpiCard(
              "Divergence / intervention",
              `${divergenceScore.toFixed(1)} / ${interventionScore.toFixed(1)}`,
              adaptationToneClass,
            )}
          </div>

          <details
            className="mb-6 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm"
            style={{ borderLeft: `3px solid ${couplingColor(coupling7)}` }}
          >
            <summary className={`cursor-pointer font-semibold ${couplingToneClass}`}>
              Adattabilita {adaptabilityScore}/100 · coupling {coupling7.toFixed(2)}
            </summary>
            <p className={`mt-2 font-semibold ${couplingToneClass}`}>{adaptationStatus}</p>
            <p className="mt-2 text-xs text-slate-500">
              Adaptation loop: planned {Math.round(adaptationLoop?.expectedLoad7d ?? 0)} · real{" "}
              {Math.round(adaptationLoop?.realLoad7d ?? 0)} · internal {Math.round(adaptationLoop?.internalLoad7d ?? 0)}{" "}
              · twin redox {(twinState?.redoxStressIndex ?? 0).toFixed(1)}
            </p>
          </details>

          {operationalContext ? (
            <details
              className={`mb-6 rounded-2xl border p-4 text-sm ${
                operationalContext.loadScalePct < 100
                  ? "border-amber-500/35 bg-amber-500/10 text-amber-50"
                  : "border-emerald-500/35 bg-emerald-500/10 text-emerald-50"
              }`}
            >
              <summary className="cursor-pointer">
                <strong>{operationalContext.headline}</strong> · carico operativo ~{operationalContext.loadScalePct}% del piano
              </summary>
              <p className="mt-2">{operationalContext.guidance}</p>
              {operationalSuggestedLoad7d != null ? (
                <p className="mt-2">
                  Finestra 7d: piano {Math.round(adaptationLoop?.expectedLoad7d ?? 0)} → operativo ~{operationalSuggestedLoad7d}.
                </p>
              ) : null}
              {recoverySummary ? (
                <p className="mt-2">
                  Recovery {recoverySummary.status}
                  {recoverySummary.sleepDurationHours != null ? ` · sonno ${recoverySummary.sleepDurationHours} h` : ""}
                  {recoverySummary.hrvMs != null ? ` · HRV ${recoverySummary.hrvMs} ms` : ""}
                  {recoverySummary.strainScore != null ? ` · strain ${recoverySummary.strainScore}` : ""}.
                </p>
              ) : null}
            </details>
          ) : null}

          {bioenergeticModulation ? (
            <details
              className={`mb-6 rounded-2xl border p-4 text-sm ${
                bioenergeticModulation.loadScalePct < 100
                  ? "border-amber-500/35 bg-amber-500/10"
                  : "border-emerald-500/35 bg-emerald-500/10"
              }`}
            >
              <summary className="cursor-pointer">
                <strong>{bioenergeticModulation.headline}</strong> · readiness{" "}
                {bioenergeticModulation.mitochondrialReadinessScore.toFixed(0)}/100
              </summary>
              <p className="mt-2">
                stato {bioenergeticModulation.state} · copertura {bioenergeticModulation.signalCoveragePct.toFixed(0)}%.
              </p>
              <p className="mt-2">{bioenergeticModulation.guidance}</p>
              {!!bioenergeticModulation.missingSignals.length ? (
                <p className="mt-2">Missing: {bioenergeticModulation.missingSignals.join(" · ")}.</p>
              ) : null}
              {!!bioenergeticModulation.recommendedInputs.length ? (
                <p className="mt-2">Suggested inputs: {bioenergeticModulation.recommendedInputs.join(" · ")}.</p>
              ) : null}
            </details>
          ) : null}

          {crossModuleDynamicsLines.length ? (
            <details className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-sm text-slate-200">
              <summary className="cursor-pointer text-sm font-bold text-cyan-100">
                Dinamica incrociata (Training → Nutrition / fueling) · {crossModuleDynamicsLines.length}
              </summary>
              <p className="mt-2 text-xs text-slate-500">
                Ponte deterministico: adattamento, carico operativo, loop calendario, dial nutrizione.
              </p>
              <ul className="mt-2 list-inside list-disc text-xs leading-relaxed text-slate-400">
                {crossModuleDynamicsLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                <LineChart className="h-4 w-4 text-cyan-400" aria-hidden />
                Confronto normalizzato (metriche sovrapposte)
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                  onClick={() => {
                    const o: Record<string, boolean> = {};
                    for (const def of OVERLAY_METRIC_DEFS) o[def.key] = true;
                    setOverlayOn(o);
                  }}
                >
                  Attiva tutte
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
                  onClick={() => {
                    const o: Record<string, boolean> = {};
                    for (const def of OVERLAY_METRIC_DEFS) {
                      o[def.key] = ["planned", "executed", "internal", "ctl", "iCtl"].includes(def.key);
                    }
                    setOverlayOn(o);
                  }}
                >
                  Solo carico
                </button>
              </div>
            </div>
            <details className="mb-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
              <summary className="cursor-pointer text-slate-300">
                Note metriche overlay · {Object.values(overlayOn).filter(Boolean).length} attive
              </summary>
              <p className="mt-2">
                Ogni serie usa il proprio min/max sui 42 giorni e viene portata su 0-100 per sovrapporre FC, smO2,
                glucosio, VO2/VCO2, temperatura e carichi nello stesso grafico.
              </p>
            </details>
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
              {OVERLAY_METRIC_DEFS.map((d) => (
                <label
                  key={d.key}
                  className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  <input
                    type="checkbox"
                    className="rounded border-white/20 bg-black/40"
                    checked={overlayOn[d.key] ?? false}
                    onChange={(e) => setOverlayOn((prev) => ({ ...prev, [d.key]: e.target.checked }))}
                  />
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    {d.label}
                  </span>
                </label>
              ))}
            </div>
            <svg viewBox="0 0 1100 260" width="100%" height="260" className="max-h-[40vh]">
              {OVERLAY_METRIC_DEFS.map((d) => {
                if (!overlayOn[d.key]) return null;
                const raw = seriesForMetric(d.key);
                const norm = normalize01Series(raw);
                return (
                  <polyline
                    key={d.key}
                    fill="none"
                    stroke={d.color}
                    strokeWidth="2"
                    strokeOpacity={0.92}
                    points={polylineNormalized(norm, 1100, 260)}
                  />
                );
              })}
            </svg>
            <div className="mt-2 text-[0.65rem] text-slate-600">
              Asse X: ultimi 42 giorni. Serie a valori nulli o costanti restano sulla linea centrale.
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <h2 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold text-white">
              <Hexagon className="h-4 w-4 text-violet-400" aria-hidden />
              Confronto esagonale · una metrica vs storico
            </h2>
            <details className="mb-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400">
              <summary className="cursor-pointer text-slate-300">
                Guida esagono · metrica {hexMetric}
              </summary>
              <p className="mt-2">
                Sei vertici = media settimanale (7 giorni) nell&apos;ultima finestra di 42 giorni; tratteggiato = stessa
                struttura sulle 6 settimane precedenti (richiede almeno 84 giorni).
              </p>
            </details>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="text-xs text-slate-400">
                Metrica
                <select
                  className="ml-2 rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-sm text-white"
                  value={hexMetric}
                  onChange={(e) => setHexMetric(e.target.value as MetricSeriesKey)}
                >
                  {OVERLAY_METRIC_DEFS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center">
              <svg viewBox="0 0 420 420" width="320" height="320" className="shrink-0">
                {Array.from({ length: 6 }, (_, i) => {
                  const t = ((-90 + i * 60) * Math.PI) / 180;
                  const cx = 210;
                  const cy = 210;
                  const r = 150;
                  const x2 = cx + r * Math.cos(t);
                  const y2 = cy + r * Math.sin(t);
                  return (
                    <line
                      key={i}
                      x1={cx}
                      y1={cy}
                      x2={x2}
                      y2={y2}
                      stroke="rgba(148,163,184,0.25)"
                      strokeWidth={1}
                    />
                  );
                })}
                <polygon
                  points={radarRingPoints(hexNorm.baseline, 210, 210, 150)}
                  fill="rgba(167,139,250,0.08)"
                  stroke="rgba(167,139,250,0.55)"
                  strokeWidth={2}
                  strokeDasharray="7 5"
                />
                <polygon
                  points={radarRingPoints(hexNorm.recent, 210, 210, 150)}
                  fill="rgba(52,211,153,0.12)"
                  stroke="#34d399"
                  strokeWidth={2.5}
                />
                {Array.from({ length: 6 }, (_, i) => {
                  const t = ((-90 + i * 60) * Math.PI) / 180;
                  const cx = 210;
                  const cy = 210;
                  const lr = 172;
                  const tx = cx + lr * Math.cos(t);
                  const ty = cy + lr * Math.sin(t);
                  const label = `S${i + 1}`;
                  return (
                    <text
                      key={i}
                      x={tx}
                      y={ty}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#64748b"
                      fontSize={11}
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>
              <div className="max-w-md text-xs text-slate-400">
                <p className="mb-2">
                  <span className="inline-block h-2 w-4 rounded-sm bg-emerald-400/90" /> <strong className="text-slate-300">Ultime 6 settimane</strong> — forma del profilo
                  recente per la metrica scelta.
                </p>
                <p>
                  <span className="inline-block h-0.5 w-4 border-t-2 border-dotted border-violet-400" />{" "}
                  <strong className="text-slate-300">Periodo precedente</strong> — stessa granularità, da confrontare
                  a colpo d’occhio.
                </p>
                {compareSeries.length < 84 ? (
                  <p className="mt-3 text-amber-200/90">Estendi il range (serve almeno ~84 giorni) per riempire il poligono tratteggiato.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-white/10 bg-black/30 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <BarChart3 className="h-4 w-4 text-sky-400" aria-hidden />
              Trend 42g · Planned vs real vs internal
            </h2>
            <svg viewBox="0 0 1100 260" width="100%" height="260" className="max-h-[40vh]">
              <polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={plannedPolyline} />
              <polyline fill="none" stroke="#ff7a1a" strokeWidth="2.5" points={extPolyline} />
              <polyline fill="none" stroke="#d946ef" strokeWidth="2.5" points={intPolyline} />
              <polyline fill="none" stroke="#ff9e4a" strokeWidth="2" points={ctlPolyline} />
              <polyline fill="none" stroke="#f59e0b" strokeWidth="2" points={iCtlPolyline} />
            </svg>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#60a5fa]" /> Planned
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#ff7a1a]" /> External
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#d946ef]" /> Internal
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#ff9e4a]" /> CTL ext
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> CTL int
              </span>
            </div>
          </div>

          <div className="mb-6 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4">
            <h2 className="mb-3 text-sm font-bold text-white">Planned vs real · finestre</h2>
            <table className="w-full min-w-[520px] text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-slate-500">
                  <th className="pb-2">Window</th>
                  <th className="pb-2">Planned</th>
                  <th className="pb-2">Real</th>
                  <th className="pb-2">Internal</th>
                  <th className="pb-2">Compliance</th>
                  <th className="pb-2">Coupling</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: "Last 7d",
                    planned: plan7?.planned ?? 0,
                    ext: plan7?.executed ?? external7,
                    int: plan7?.internal ?? internal7,
                    compliance: plan7?.compliancePct ?? 0,
                    coupling: coupling7,
                  },
                  {
                    label: "Last 28d",
                    planned: plan28?.planned ?? 0,
                    ext: plan28?.executed ?? external28,
                    int: plan28?.internal ?? internal28,
                    compliance: plan28?.compliancePct ?? 0,
                    coupling: coupling28,
                  },
                ].map((r) => {
                  const color = couplingColor(r.coupling);
                  return (
                    <tr key={r.label} className="border-b border-white/5" style={{ background: `${color}14` }}>
                      <td className="py-2">{r.label}</td>
                      <td className="py-2 tabular-nums">{r.planned.toFixed(0)}</td>
                      <td className="py-2 tabular-nums">{r.ext.toFixed(0)}</td>
                      <td className="py-2 tabular-nums">{r.int.toFixed(0)}</td>
                      <td className="py-2 tabular-nums">{r.compliance.toFixed(0)}%</td>
                      <td className="py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-bold"
                          style={{
                            border: `1px solid ${color}`,
                            color,
                            background: `${color}22`,
                          }}
                        >
                          {r.coupling.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <details className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <summary className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-bold text-white">
              <LineChart className="h-4 w-4 text-violet-400" aria-hidden />
              Adaptation loop · adattabilita {adaptabilityScore}/100
            </summary>
            <table className="w-full text-left text-sm text-slate-300">
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-2 text-slate-500">Status / next</td>
                  <td className="py-2">{`${adaptationLoop?.status ?? "aligned"} / ${adaptationLoop?.nextAction ?? "keep_course"}`}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Expected 7d</td>
                  <td className="py-2 tabular-nums">{Math.round(adaptationLoop?.expectedLoad7d ?? 0)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Real 7d</td>
                  <td className="py-2 tabular-nums">{Math.round(adaptationLoop?.realLoad7d ?? 0)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Internal 7d</td>
                  <td className="py-2 tabular-nums">{Math.round(adaptationLoop?.internalLoad7d ?? 0)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Compliance</td>
                  <td className="py-2 tabular-nums">{(adaptationLoop?.executionCompliancePct ?? 0).toFixed(0)}%</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Readiness / adaptation</td>
                  <td className="py-2 tabular-nums">{`${(adaptationLoop?.readinessScore ?? 0).toFixed(1)} / ${(adaptationLoop?.adaptationScore ?? 0).toFixed(1)}`}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Divergence / intervention</td>
                  <td className="py-2 tabular-nums">{`${(adaptationLoop?.divergenceScore ?? 0).toFixed(1)} / ${(adaptationLoop?.interventionScore ?? 0).toFixed(1)}`}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Data points</td>
                  <td className="py-2">{`${plannedRows.length} planned · ${rows.length} executed`}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Triggers</td>
                  <td className="py-2">{adaptationLoop?.triggers?.length ? adaptationLoop.triggers.join(" · ") : "—"}</td>
                </tr>
                <tr>
                  <td className="py-2 text-slate-500">Guidance</td>
                  <td className="py-2 text-slate-400">{adaptationLoop?.guidance ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </>
      )}
    </Pro2ModulePageShell>
  );
}
