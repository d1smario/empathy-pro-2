"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, BookOpen, CalendarRange, GitBranch, LineChart, Timer } from "lucide-react";
import type {
  BioenergeticBiaLiteratureSummaryV1,
  BioenergeticCurveDirectionHintsResponseV1,
  BioenergeticCurveDirectionSegmentV1,
  BioenergeticMetricTile,
  BioenergeticMetricTileCategory,
  BioenergeticMonitoringChannel24,
  BioenergeticPathwayImpact,
  BioenergeticPredictorCurvesResponseV1,
  BioenergeticTimelineEvent,
  BioenergeticsDayViewModel,
  BioenergeticsTimeSeriesStreamResponseV1,
  BioenergeticsWindowViewModel,
} from "@/api/bioenergetics/contracts";
import { GenerativeModuleSubnav } from "@/components/navigation/GenerativeModuleSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import {
  readPersistedNutritionPlanDate,
  writePersistedNutritionPlanDate,
} from "@/lib/nutrition/persisted-nutrition-plan-date";
import {
  evidenceLinkCountForSkeletonEdge,
  evidenceLinkCountForSkeletonNode,
} from "@/lib/bioenergetics/bioenergetic-evidence-skeleton-bridge";
import { BIOENERGETIC_WINDOW_MAX_DAYS, enumerateInclusiveIsoDates } from "@/lib/bioenergetics/bioenergetic-window-range";
import {
  buildBioenergeticWindowStreamChartRows,
  buildBioenergeticWindowStreamDailyRollups,
  computeBioenergeticWindowStreamStats,
  computeBioenergeticWindowStreamVariability,
} from "@/lib/bioenergetics/window-stream-stats";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { BioenergeticsContinuousMonitoringGrid } from "@/modules/bioenergetics/components/BioenergeticsContinuousMonitoringGrid";
import { BioenergeticsDaySeriesPanel } from "@/modules/bioenergetics/components/BioenergeticsDaySeriesPanel";
import { BioenergeticsPathway24Chart } from "@/modules/bioenergetics/components/BioenergeticsPathway24Chart";
import { BioenergeticsWindowStreamChart } from "@/modules/bioenergetics/components/BioenergeticsWindowStreamChart";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysIsoDate(dateIso: string, deltaDays: number): string {
  const base = new Date(`${dateIso.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return dateIso.slice(0, 10);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

function coerceIsoDate(s: string | null | undefined): string | null {
  const u = (s ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(u) ? u : null;
}

const CATEGORY_LABEL: Record<BioenergeticMetricTileCategory, string> = {
  metabolic: "Metabolismo & substrati",
  inflammatory: "Infiammazione (contesto)",
  hormonal: "Ormonale",
  neural: "Neuromodulatori",
  gastro_intestinal: "Gastro-enterico",
  gonadal: "Asse gonadico",
};

function impactTileClass(impact: BioenergeticPathwayImpact): string {
  if (impact === "supportive") return "border-emerald-400/35 bg-emerald-500/[0.07]";
  if (impact === "inhibitory") return "border-rose-400/35 bg-rose-500/[0.07]";
  return "border-white/12 bg-white/[0.04]";
}

function provenanceLabel(p: BioenergeticMetricTile["provenance"]): string {
  if (p === "measured") return "Misurato";
  if (p === "estimated") return "Stimato";
  if (p === "planned") return "Da piano";
  return "Assente";
}

function biaCellularBandIt(b: BioenergeticBiaLiteratureSummaryV1["cellularGeometry"]["band"]): string {
  if (b === "low_support_cue") return "Geometria cellulare: segnale basso (letteratura)";
  if (b === "mid") return "Geometria cellulare: intermedio";
  if (b === "favourable_geometry_cue") return "Geometria cellulare: segnale favorevole (contesto)";
  return "Geometria cellulare: dati insufficienti";
}

function biaFluidBandIt(b: BioenergeticBiaLiteratureSummaryV1["extracellularFluid"]["band"]): string {
  if (b === "favourable_balance") return "ECW vs TBW: bilanciamento favorevole";
  if (b === "neutral") return "ECW vs TBW: neutro";
  if (b === "extracellular_shift_cue") return "ECW vs TBW: spostamento extracellulare (letteratura)";
  return "ECW vs TBW: dati insufficienti";
}

const TIMELINE_MODEL_TYPES = new Set<BioenergeticTimelineEvent["type"]>(["meal", "planned_session", "executed_session"]);

export default function BioenergeticsPageView() {
  const searchParams = useSearchParams();
  const { athleteId, loading: athleteLoading } = useActiveAthlete();
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vm, setVm] = useState<BioenergeticsDayViewModel | null>(null);
  const [windowFrom, setWindowFrom] = useState(() => addDaysIsoDate(toIsoDate(new Date()), -6));
  const [windowTo, setWindowTo] = useState(() => toIsoDate(new Date()));
  const [windowVm, setWindowVm] = useState<BioenergeticsWindowViewModel | null>(null);
  const [windowStream, setWindowStream] = useState<BioenergeticsTimeSeriesStreamResponseV1 | null>(null);
  const [windowStreamError, setWindowStreamError] = useState<string | null>(null);
  const [windowLoading, setWindowLoading] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);
  const [curveDirectionHints, setCurveDirectionHints] = useState<BioenergeticCurveDirectionSegmentV1[] | null>(null);
  const [curveHintsSummary, setCurveHintsSummary] = useState<string | null>(null);
  const [curveHintsNote, setCurveHintsNote] = useState<string | null>(null);
  const [curveHintsLoading, setCurveHintsLoading] = useState(false);
  const [curveHintsError, setCurveHintsError] = useState<string | null>(null);
  const [predictorChannels, setPredictorChannels] = useState<BioenergeticMonitoringChannel24[] | null>(null);
  const [predictorDisclaimer, setPredictorDisclaimer] = useState<string | null>(null);
  const [predictorNote, setPredictorNote] = useState<string | null>(null);
  const [predictorLoading, setPredictorLoading] = useState(false);
  const [predictorError, setPredictorError] = useState<string | null>(null);
  const [predictorDemoLocal, setPredictorDemoLocal] = useState(false);
  const seededFromContext = useRef(false);
  const genBodyRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setCurveDirectionHints(null);
    setCurveHintsSummary(null);
    setCurveHintsNote(null);
    setCurveHintsError(null);
    setPredictorChannels(null);
    setPredictorDisclaimer(null);
    setPredictorNote(null);
    setPredictorError(null);
    setPredictorDemoLocal(false);
  }, [athleteId, date]);

  useEffect(() => {
    seededFromContext.current = false;
  }, [athleteId]);

  useEffect(() => {
    const fromUrl = coerceIsoDate(searchParams.get("date"));
    if (fromUrl) {
      setDate((d) => (d === fromUrl ? d : fromUrl));
      seededFromContext.current = true;
      return;
    }
    if (!athleteId || athleteLoading) return;
    if (seededFromContext.current) return;
    seededFromContext.current = true;
    const persisted = readPersistedNutritionPlanDate(athleteId);
    if (persisted) setDate((d) => (d === persisted ? d : persisted));
  }, [searchParams, athleteId, athleteLoading]);

  useEffect(() => {
    setWindowTo(date);
    setWindowFrom(addDaysIsoDate(date, -6));
    setWindowVm(null);
    setWindowStream(null);
    setWindowStreamError(null);
    setWindowError(null);
  }, [date]);

  const loadBioenergeticWindow = useCallback(async () => {
    if (!athleteId) return;
    const range = enumerateInclusiveIsoDates(windowFrom, windowTo);
    if (!range.ok) {
      setWindowError(
        range.error === `window_max_${BIOENERGETIC_WINDOW_MAX_DAYS}_days`
          ? `Intervallo troppo lungo (massimo ${BIOENERGETIC_WINDOW_MAX_DAYS} giorni inclusi).`
          : "Intervallo date non valido.",
      );
      setWindowVm(null);
      setWindowStream(null);
      setWindowStreamError(null);
      return;
    }
    setWindowLoading(true);
    setWindowError(null);
    setWindowStreamError(null);
    setWindowStream(null);
    try {
      const headers = await buildSupabaseAuthHeaders();
      const q = new URLSearchParams({ athleteId, from: range.dates[0]!, to: range.dates[range.dates.length - 1]! });
      const qs = q.toString();
      const [winRes, streamRes] = await Promise.all([
        fetch(`/api/bioenergetics/window?${qs}`, { cache: "no-store", credentials: "same-origin", headers }),
        fetch(`/api/bioenergetics/streams?${qs}&channel=all`, { cache: "no-store", credentials: "same-origin", headers }),
      ]);
      const winJson = (await winRes.json()) as BioenergeticsWindowViewModel & { error?: string };
      if (!winRes.ok) {
        setWindowVm(null);
        setWindowStream(null);
        setWindowStreamError(null);
        setWindowError(winJson.error ?? "Caricamento finestra non riuscito.");
        return;
      }
      setWindowVm(winJson);
      setWindowError(null);
      const streamJson = (await streamRes.json()) as BioenergeticsTimeSeriesStreamResponseV1 & { error?: string };
      if (!streamRes.ok) {
        setWindowStream(null);
        setWindowStreamError(streamJson.error ?? "Caricamento serie misurata non riuscito.");
        return;
      }
      if (streamJson.streamContractVersion !== 1) {
        setWindowStream(null);
        setWindowStreamError("Risposta serie non valida.");
        return;
      }
      setWindowStream(streamJson);
      setWindowStreamError(null);
    } catch {
      setWindowVm(null);
      setWindowStream(null);
      setWindowStreamError(null);
      setWindowError("Errore di rete durante il caricamento della finestra.");
    } finally {
      setWindowLoading(false);
    }
  }, [athleteId, windowFrom, windowTo]);

  const setDateAndPersist = useCallback(
    (next: string) => {
      const k = coerceIsoDate(next);
      if (!k) return;
      setDate(k);
      if (athleteId) writePersistedNutritionPlanDate(athleteId, k);
      if (typeof window !== "undefined") {
        const u = new URL(window.location.href);
        u.searchParams.set("date", k);
        const qs = u.searchParams.toString();
        window.history.replaceState({}, "", qs ? `${u.pathname}?${qs}${u.hash}` : `${u.pathname}${u.hash}`);
      }
    },
    [athleteId],
  );

  const openWindowDayInBody = useCallback(
    (dayIso: string) => {
      setDateAndPersist(dayIso);
      requestAnimationFrame(() => {
        genBodyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [setDateAndPersist],
  );

  const fetchCurveDirectionHints = useCallback(async () => {
    if (!athleteId) return;
    setCurveHintsLoading(true);
    setCurveHintsError(null);
    try {
      const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/bioenergetics/curve-direction-hints", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ athleteId, date }),
      });
      const j = (await res.json()) as BioenergeticCurveDirectionHintsResponseV1 & { error?: string };
      if (!("hintsContractVersion" in j) || j.hintsContractVersion !== 1) {
        setCurveDirectionHints(null);
        setCurveHintsSummary(null);
        setCurveHintsNote(null);
        setCurveHintsError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      const segments = Array.isArray(j.segments) ? j.segments : [];
      setCurveDirectionHints(segments);
      const rawSum = typeof j.summaryIt === "string" ? j.summaryIt.trim() : "";
      setCurveHintsSummary(rawSum && rawSum !== "—" ? rawSum : null);
      setCurveHintsNote(j.noteIt ?? null);
      if (j.skippedReason === "no_openai" || j.skippedReason === "assemble_failed") {
        setCurveHintsError(j.noteIt ?? j.skippedReason);
      } else if (!segments.length && (j.noteIt || j.skippedReason)) {
        setCurveHintsError(j.noteIt ?? String(j.skippedReason));
      } else {
        setCurveHintsError(null);
      }
    } catch {
      setCurveDirectionHints(null);
      setCurveHintsSummary(null);
      setCurveHintsNote(null);
      setCurveHintsError("Errore di rete durante l’analisi AI.");
    } finally {
      setCurveHintsLoading(false);
    }
  }, [athleteId, date]);

  const fetchPredictorCurves = useCallback(async () => {
    if (!athleteId) return;
    setPredictorLoading(true);
    setPredictorError(null);
    try {
      const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/bioenergetics/predictor-curves", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ athleteId, date }),
      });
      const j = (await res.json()) as BioenergeticPredictorCurvesResponseV1 & { error?: string };
      if (!("predictorContractVersion" in j) || j.predictorContractVersion !== 1) {
        setPredictorChannels(null);
        setPredictorDisclaimer(null);
        setPredictorNote(null);
        setPredictorDemoLocal(false);
        setPredictorError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      const chans = Array.isArray(j.channels) ? j.channels : [];
      const rawDisc = typeof j.disclaimerIt === "string" ? j.disclaimerIt.trim() : "";
      setPredictorDisclaimer(rawDisc && rawDisc !== "—" ? rawDisc : null);
      setPredictorNote(j.noteIt ?? null);
      if (!chans.length) {
        setPredictorChannels(null);
        setPredictorDemoLocal(false);
        const skipMsg =
          j.noteIt?.trim() ||
          (rawDisc && rawDisc !== "—" ? rawDisc : "") ||
          (typeof j.skippedReason === "string" ? j.skippedReason : "") ||
          "Nessuna curva generata.";
        setPredictorError(skipMsg);
        if (j.skippedReason === "no_openai") {
          setPredictorDisclaimer(null);
        }
        return;
      }
      setPredictorChannels(chans);
      setPredictorDemoLocal(j.skippedReason === "predictor_demo_local");
      setPredictorError(null);
      setCurveDirectionHints(null);
      setCurveHintsSummary(null);
      setCurveHintsNote(null);
      setCurveHintsError(null);
    } catch {
      setPredictorChannels(null);
      setPredictorDisclaimer(null);
      setPredictorNote(null);
      setPredictorDemoLocal(false);
      setPredictorError("Errore di rete durante il predittore AI.");
    } finally {
      setPredictorLoading(false);
    }
  }, [athleteId, date]);

  useEffect(() => {
    if (athleteLoading) return;
    if (!athleteId) {
      setVm(null);
      setError("Seleziona un atleta attivo per generare il report bioenergetico.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ athleteId, date });
        const res = await fetch(`/api/bioenergetics/day?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        const json = (await res.json()) as BioenergeticsDayViewModel & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setVm(null);
          setError(json.error ?? "Lettura BioEnergetic Intelligence non riuscita.");
          return;
        }
        const cm = json.continuousMonitoring as BioenergeticsDayViewModel["continuousMonitoring"] | undefined;
        const vmPayload: BioenergeticsDayViewModel = {
          ...json,
          dayContractVersion: json.dayContractVersion ?? 1,
          canonicalStreamCounts: json.canonicalStreamCounts ?? {
            glucoseSampleCount: 0,
            lactateSampleCount: 0,
          },
          series: Array.isArray(json.series) ? json.series : [],
          evidenceConditionedLayer: json.evidenceConditionedLayer ?? null,
          continuousMonitoring:
            cm && typeof cm === "object" && cm.layer === "model_continuous_v1" && Array.isArray(cm.channels)
              ? cm
              : undefined,
        };
        setVm(vmPayload);
      } catch {
        if (!cancelled) {
          setVm(null);
          setError("Errore di rete durante il caricamento.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, athleteLoading, date]);

  /** Solo glucosio/lattato da CGM o lab quel giorno (non include potenza/trace né piano). */
  const measuredGluLacBadge = useMemo(() => {
    if (!vm) return "—";
    const measuredCount = [vm.provenance.glucose, vm.provenance.lactate].filter((p) => p === "measured").length;
    return `${measuredCount}/2`;
  }, [vm]);

  const canonicalStreamSummary = useMemo(() => {
    if (!vm) return null;
    const g = vm.canonicalStreamCounts.glucoseSampleCount;
    const l = vm.canonicalStreamCounts.lactateSampleCount;
    if (g === 0 && l === 0) return null;
    return `Serie canonica (055): ${g} campioni glucosio · ${l} lattato`;
  }, [vm]);

  const traceSeriesCount = useMemo(() => {
    if (!vm?.series?.length) return 0;
    const traceIds = new Set(["power_w", "hr_bpm", "speed_kmh", "cadence_rpm", "altitude_m", "temperature_c"]);
    return vm.series.filter((s) => traceIds.has(s.id) && s.provenance === "measured" && s.points.length >= 2).length;
  }, [vm]);

  const windowStreamStats = useMemo(
    () => computeBioenergeticWindowStreamStats(windowStream?.samples ?? []),
    [windowStream],
  );
  const windowStreamRows = useMemo(() => buildBioenergeticWindowStreamChartRows(windowStream?.samples ?? []), [windowStream]);
  const windowDailyRollups = useMemo(
    () => buildBioenergeticWindowStreamDailyRollups(windowStream?.samples ?? []),
    [windowStream],
  );
  const windowStreamVariability = useMemo(
    () => computeBioenergeticWindowStreamVariability(windowDailyRollups),
    [windowDailyRollups],
  );

  const timelineModelStimuli = useMemo(() => {
    if (!vm?.timeline?.length) return [];
    return [...vm.timeline].filter((e) => TIMELINE_MODEL_TYPES.has(e.type)).sort((a, b) => a.ts.localeCompare(b.ts));
  }, [vm?.timeline]);

  const monitoringForStrip = useMemo(() => {
    if (!vm?.continuousMonitoring) return null;
    if (!predictorChannels?.length) return vm.continuousMonitoring;
    const pmap = new Map(predictorChannels.map((c) => [c.id, c]));
    return {
      ...vm.continuousMonitoring,
      channels: vm.continuousMonitoring.channels.map((ch) => {
        const p = pmap.get(ch.id);
        if (!p) return ch;
        return { ...ch, ...p };
      }),
    };
  }, [vm?.continuousMonitoring, predictorChannels]);

  const resolvedEvidenceLinks = vm?.evidenceConditionedLayer?.resolvedEvidenceLinks ?? [];
  const evidenceLinkCount = resolvedEvidenceLinks.length;

  return (
    <Pro2ModulePageShell
      eyebrow="BioEnergetic Intelligence · Focus"
      eyebrowClassName="text-lime-400"
      title="BioEnergetic Intelligence"
      description="Monitoraggio continuo (modello v1) sulla giornata: timeline training/nutrizione/device, strisce 24 h per analita, pathway supportivo o inibitorio — contratto pronto a integrazione stream device."
      headerActions={
        <>
          <Pro2Link href="/nutrition" variant="secondary" className="justify-center border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15">
            Nutrition
          </Pro2Link>
          <Pro2Link href="/training/calendar" variant="ghost" className="justify-center border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15">
            Calendar
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        <GenerativeModuleSubnav />
      </div>

      <section id="gen-domain" className="scroll-mt-28">
        <Pro2SectionCard accent="emerald" title="Range giornata" subtitle="Seleziona giorno report" icon={Timer}>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDateAndPersist(e.currentTarget.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <p className="max-w-xl text-xs leading-relaxed text-gray-400">
              La data di default segue il <strong className="text-gray-200">giorno piano Nutrizione</strong> (stesso valore in sessionStorage per atleta) oppure{" "}
              <code className="text-gray-300">?date=YYYY-MM-DD</code> nell&apos;URL. Cambiando qui si aggiornano anche Nutrizione e il link condiviso.
            </p>
          </div>
        </Pro2SectionCard>
      </section>

      <section id="gen-window" className="scroll-mt-28">
        <Pro2SectionCard
          accent="violet"
          title="Finestra multi-giorno"
          subtitle={`Tabella giornaliera + grafico serie misurate (055) su asse tempo; fino a ${BIOENERGETIC_WINDOW_MAX_DAYS} giorni inclusi; evidenza DB una volta per finestra.`}
          icon={CalendarRange}
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              Da
              <input
                type="date"
                value={windowFrom}
                onChange={(e) => setWindowFrom(e.currentTarget.value.slice(0, 10))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              A
              <input
                type="date"
                value={windowTo}
                onChange={(e) => setWindowTo(e.currentTarget.value.slice(0, 10))}
                className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            <Pro2Button
              type="button"
              variant="primary"
              onClick={() => void loadBioenergeticWindow()}
              disabled={!athleteId || athleteLoading || windowLoading}
              className="shrink-0"
            >
              {windowLoading ? "Carico…" : "Carica finestra"}
            </Pro2Button>
          </div>
          {windowError ? <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{windowError}</p> : null}
          {windowVm?.days?.length ? (
            <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-sm text-gray-200">
                <thead className="sticky top-0 bg-black/90 text-[0.65rem] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Pathway</th>
                    <th className="px-3 py-2">Timeline</th>
                    <th className="px-3 py-2">TS 055</th>
                    <th className="px-3 py-2 w-[1%] whitespace-nowrap" />
                  </tr>
                </thead>
                <tbody>
                  {windowVm.days.map((d) => (
                    <tr key={d.date} className="border-t border-white/5">
                      <td className="px-3 py-2 font-mono text-xs text-white">{d.date}</td>
                      <td className="px-3 py-2 capitalize">{d.kernel.pathwayState}</td>
                      <td className="px-3 py-2">{d.timeline.length}</td>
                      <td className="px-3 py-2 text-xs text-violet-200/90">
                        glu {d.canonicalStreamCounts.glucoseSampleCount} · lac {d.canonicalStreamCounts.lactateSampleCount}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Pro2Button
                          type="button"
                          variant="ghost"
                          className="shrink-0 !px-3 !py-1.5 text-xs font-semibold"
                          onClick={() => openWindowDayInBody(d.date)}
                        >
                          Giorno
                        </Pro2Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {windowVm?.days?.length ? (
            <>
              {windowStreamError ? (
                <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{windowStreamError}</p>
              ) : null}
              {windowStream ? (
                <BioenergeticsWindowStreamChart
                  rows={windowStreamRows}
                  stats={windowStreamStats}
                  variability={windowStreamVariability}
                  dailyRollups={windowDailyRollups}
                  truncated={windowStream.truncated}
                  skippedSchema={windowStream.skippedSchema}
                />
              ) : null}
            </>
          ) : null}
        </Pro2SectionCard>
      </section>

      <section id="gen-body" ref={genBodyRef} className="scroll-mt-28 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-cyan-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-cyan-300">Eventi timeline</p>
            <p className="mt-1 text-xl font-semibold text-white">{vm?.timeline.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-lime-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-lime-300">Glicemia / lattato (CGM o lab)</p>
            <p className="mt-1 text-xl font-semibold text-white">{measuredGluLacBadge}</p>
            {canonicalStreamSummary ? (
              <p className="mt-1 text-[0.65rem] leading-snug text-lime-200/75">{canonicalStreamSummary}</p>
            ) : null}
            <p className="mt-1 text-[0.65rem] leading-snug text-gray-500">
              Serie da trace allenamento:{" "}
              <span className="text-lime-200/90">{traceSeriesCount > 0 ? `${traceSeriesCount} con ≥2 punti` : "nessuna"}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-fuchsia-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-fuchsia-300">Pathway state</p>
            <p className="mt-1 text-xl font-semibold capitalize text-white">{vm?.kernel.pathwayState ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-orange-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-orange-300">Link evidenza assi ↔ fluidi</p>
            <p className="mt-1 text-xl font-semibold text-white">{vm ? evidenceLinkCount : "—"}</p>
            <p className="mt-1 text-[0.65rem] leading-snug text-gray-500">
              Da DB curato <span className="text-orange-200/90">051 + 052</span>; non è modello curva giornaliera.
            </p>
          </div>
        </div>

        {error ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</p> : null}
        {athleteLoading || loading ? (
          <div className="space-y-2">
            <div className="h-3 w-full max-w-xl animate-pulse rounded bg-white/10" />
            <div className="h-24 w-full animate-pulse rounded-2xl bg-white/5" />
          </div>
        ) : null}

        {vm && vm.timeline.length === 0 ? (
          <p className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            Per <strong className="text-white">{vm.date}</strong> non risultano ancora eventi in timeline (sessioni pianificate/eseguite nel range, voci diario, export device o lab con
            quella data). I grafici mostrano comunque il modello kernel; per arricchire i dati usa{" "}
            <Pro2Link href="/nutrition/diary" className="text-cyan-200 underline-offset-2 hover:text-white">
              Diario
            </Pro2Link>{" "}
            e{" "}
            <Pro2Link href="/training/calendar" className="text-cyan-200 underline-offset-2 hover:text-white">
              Calendario
            </Pro2Link>{" "}
            con la stessa data.
          </p>
        ) : null}

        {vm ? (
          <>
            <Pro2SectionCard
              accent="fuchsia"
              title="Via metabolica · 24 h"
              subtitle="Monitoraggio continuo (modello): bilancio pathway, glucosio e lattato; fascia = impatto orario. Stesso paradigma UI sostituibile da stream device."
              icon={LineChart}
            >
              <BioenergeticsPathway24Chart data={vm.chart24h ?? []} />
              {monitoringForStrip?.channels?.length ? (
                <div className="mt-6 border-t border-white/10 pt-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fuchsia-200/85">
                    Striscia monitoraggio continuo (24 h)
                  </p>
                  <p className="mb-4 text-[0.7rem] leading-relaxed text-gray-500">
                    Solo glucosio, lattato, domanda insulinica (da diario + sedute), cortisolo e ACTH. Passo 5 minuti,
                    deterministico dalla timeline sotto: non è CGM né clinica. Se gli orari non coincidono con ciò che
                    ti aspetti, verifica timestamp diario e calendario (non il modello che &quot;indovina&quot; i pasti).
                    {predictorChannels?.length ? (
                      <>
                        {" "}
                        <span className="text-fuchsia-200/90">
                          Alcune strisce possono essere in modalità predittore AI (andamento illustrativo, non valore
                          vero).
                        </span>
                      </>
                    ) : null}
                  </p>
                  {timelineModelStimuli.length ? (
                    <div className="mb-4 rounded-xl border border-fuchsia-500/20 bg-black/35 p-3">
                      <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-fuchsia-200/90">
                        Stimoli nella timeline usati dal motore
                      </p>
                      <p className="mb-2 text-[0.65rem] leading-relaxed text-gray-500">
                        Pasti: orario da <code className="text-gray-400">entry_time</code> / data voce diario. Sedute:
                        esecuzione (<code className="text-gray-400">started_at</code>) o slot pianificato se manca
                        l&apos;esecuzione.
                      </p>
                      <ul className="max-h-40 space-y-1.5 overflow-y-auto text-[0.7rem] text-gray-200">
                        {timelineModelStimuli.map((e) => (
                          <li
                            key={e.id}
                            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                          >
                            <span className="shrink-0 font-mono text-[0.65rem] text-fuchsia-200/90">{e.ts}</span>
                            <span className="shrink-0 text-gray-500">
                              {e.type === "meal"
                                ? "Pasto"
                                : e.type === "executed_session"
                                  ? "Seduta eseguita"
                                  : "Seduta pianificata"}
                            </span>
                            <span className="min-w-0 flex-1 text-gray-100">{e.title}</span>
                            {e.type === "meal" ? (
                              <span className="shrink-0 text-gray-500">
                                {typeof e.payload?.carbsG === "number" && Number.isFinite(e.payload.carbsG)
                                  ? `${Math.round(e.payload.carbsG)} g CHO`
                                  : "CHO n/d"}
                                {typeof e.payload?.glycemic_index_estimate === "number" &&
                                Number.isFinite(e.payload.glycemic_index_estimate)
                                  ? ` · GI ~${Math.round(e.payload.glycemic_index_estimate)}`
                                  : ""}
                              </span>
                            ) : (
                              <span className="shrink-0 text-gray-500">
                                {typeof e.payload?.durationMinutes === "number" &&
                                Number.isFinite(e.payload.durationMinutes)
                                  ? `${Math.round(e.payload.durationMinutes)} min`
                                  : ""}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : vm.timeline.length ? (
                    <p className="mb-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[0.7rem] leading-relaxed text-amber-100/95">
                      Nessun pasto o seduta in timeline per questo giorno: le curve usano solo modulazioni diurne /
                      sonno e default — aggiungi voci in Diario o sessioni in Calendario con la data corretta.
                    </p>
                  ) : null}
                  <div className="mb-4 flex flex-wrap items-start gap-3">
                    <Pro2Button
                      type="button"
                      variant="secondary"
                      className="!text-xs shrink-0"
                      disabled={!athleteId || athleteLoading || predictorLoading || curveHintsLoading}
                      onClick={() => void fetchPredictorCurves()}
                    >
                      {predictorLoading ? "Predittore AI…" : "Curve predittore (AI)"}
                    </Pro2Button>
                    {predictorChannels?.length ? (
                      <Pro2Button
                        type="button"
                        variant="ghost"
                        className="!text-xs shrink-0"
                        onClick={() => {
                          setPredictorChannels(null);
                          setPredictorDisclaimer(null);
                          setPredictorNote(null);
                          setPredictorError(null);
                          setPredictorDemoLocal(false);
                        }}
                      >
                        Ripristina motore
                      </Pro2Button>
                    ) : null}
                    <p className="min-w-[12rem] flex-1 text-[0.65rem] leading-relaxed text-gray-500">
                      Legge la stessa giornata assemblata e traccia <strong className="text-gray-300">curve illustrative</strong>{" "}
                      (salita, discesa, forma d&apos;onda) per orientamento — non sostituisce misure né valori clinici.
                      Con <code className="text-gray-400">OPENAI_API_KEY</code> usa il modello; in <code className="text-gray-400">npm run dev</code> senza chiave
                      compaiono curve <strong className="text-gray-300">demo locali</strong> (stessa UI).
                    </p>
                  </div>
                  {predictorError ? (
                    <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
                      {predictorError}
                    </p>
                  ) : null}
                  {predictorDemoLocal && predictorChannels?.length ? (
                    <p className="mb-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-[0.65rem] text-cyan-100/95">
                      Stai vedendo la <strong className="text-white">demo locale</strong> (dati sintetici fissi, nessuna chiamata OpenAI).
                    </p>
                  ) : null}
                  {predictorDisclaimer && (predictorChannels?.length || predictorError) ? (
                    <p className="mb-3 rounded-lg border border-fuchsia-500/35 bg-fuchsia-500/10 px-3 py-2 text-[0.7rem] leading-relaxed text-fuchsia-50/95">
                      {predictorDisclaimer}
                    </p>
                  ) : null}
                  {predictorNote && predictorChannels?.length ? (
                    <p className="mb-3 text-[0.65rem] leading-snug text-gray-500">{predictorNote}</p>
                  ) : null}
                  <div className="mb-4 flex flex-wrap items-start gap-3">
                    <Pro2Button
                      type="button"
                      variant="secondary"
                      className="!text-xs shrink-0"
                      disabled={!athleteId || athleteLoading || curveHintsLoading || predictorLoading}
                      onClick={() => void fetchCurveDirectionHints()}
                    >
                      {curveHintsLoading ? "Analisi AI…" : "Analisi AI: dove sale / scende (fasce)"}
                    </Pro2Button>
                    {curveDirectionHints?.length ? (
                      <Pro2Button
                        type="button"
                        variant="ghost"
                        className="!text-xs shrink-0"
                        onClick={() => {
                          setCurveDirectionHints(null);
                          setCurveHintsSummary(null);
                          setCurveHintsNote(null);
                          setCurveHintsError(null);
                        }}
                      >
                        Rimuovi fasce
                      </Pro2Button>
                    ) : null}
                    <p className="min-w-[12rem] flex-1 text-[0.65rem] leading-relaxed text-gray-500">
                      Legge la stessa giornata del motore (timeline, kernel, serie 5 min sottocampionate) e restituisce
                      solo <strong className="text-gray-300">direzioni attese</strong> (verde salita, ciano discesa,
                      grigio plateau). I numeri sulla linea restano deterministici. Richiede{" "}
                      <code className="text-gray-400">OPENAI_API_KEY</code>.
                    </p>
                  </div>
                  {curveHintsError ? (
                    <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
                      {curveHintsError}
                    </p>
                  ) : null}
                  {curveHintsSummary ? (
                    <div className="mb-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] px-3 py-2">
                      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-violet-200/90">
                        Sintesi interpretazione
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-gray-200">{curveHintsSummary}</p>
                      {curveHintsNote ? (
                        <p className="mt-2 text-[0.65rem] leading-snug text-gray-500">{curveHintsNote}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {curveDirectionHints?.length ? (
                    <details className="mb-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                      <summary className="cursor-pointer text-[0.7rem] text-gray-300">
                        Dettaglio segmenti ({curveDirectionHints.length})
                      </summary>
                      <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-[0.68rem] text-gray-400">
                        {curveDirectionHints.map((s) => (
                          <li key={`${s.channel}-${s.startObservedAt}-${s.endObservedAt}`} className="border-b border-white/5 pb-2 last:border-0">
                            <span className="font-mono text-fuchsia-200/90">{s.channel}</span>{" "}
                            <span className="text-gray-500">
                              {s.trend === "rise" ? "↑" : s.trend === "fall" ? "↓" : "→"}
                            </span>{" "}
                            <span className="text-gray-500">
                              {s.startObservedAt.slice(11, 16)}–{s.endObservedAt.slice(11, 16)}
                            </span>
                            <p className="mt-0.5 text-gray-300">{s.rationaleIt}</p>
                            {s.drivers.length ? (
                              <p className="mt-0.5 text-gray-500">{s.drivers.join(" · ")}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  <BioenergeticsContinuousMonitoringGrid
                    monitoring={monitoringForStrip}
                    curveDirectionHints={curveDirectionHints}
                  />
                </div>
              ) : null}
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-fuchsia-200/80">Serie da memoria giorno</p>
                <BioenergeticsDaySeriesPanel series={vm.series ?? []} />
              </div>
            </Pro2SectionCard>

            {vm.interactionSkeleton ? (
              <div id="bioenergetic-skeleton-layer" className="scroll-mt-24">
              <Pro2SectionCard
                accent="slate"
                title="Rete metabolico-endocrina · scheletro v1"
                subtitle={
                  evidenceLinkCount > 0
                    ? "Grafo dichiarativo (nutrizione, training, stress, sonno, lab). Badge arancione «DB»: link curati assi–fluidi (051/052) mappati a quel nodo o arco — vedi sezione evidenza sotto."
                    : "Un solo grafo di interazioni (nutrizione, training, stress, lab): si espande nel tempo; oggi dichiara cosa è osservabile e cosa manca."
                }
                icon={GitBranch}
              >
                {evidenceLinkCount > 0 ? (
                  <p className="mb-2 text-[0.7rem] text-orange-200/90">
                    <a
                      href="#bioenergetic-evidence-layer"
                      className="underline decoration-orange-400/50 underline-offset-2 hover:text-orange-100"
                    >
                      Salta all’evidenza letteratura (assi–fluidi)
                    </a>{" "}
                    · {evidenceLinkCount} link caricati
                  </p>
                ) : null}
                <p className="text-sm leading-relaxed text-gray-300">{vm.interactionSkeleton.northStarIt}</p>
                {vm.interactionSkeleton.longestInterMealGapHoursEstimate != null ? (
                  <p className="mt-2 font-mono text-[0.7rem] text-gray-500">
                    Max intervallo inter-prandiale stimato (timeline):{" "}
                    <span className="text-gray-300">{vm.interactionSkeleton.longestInterMealGapHoursEstimate} h</span>
                  </p>
                ) : null}
                <ul className="mt-4 space-y-2">
                  {vm.interactionSkeleton.nodes.map((n) => {
                    const dbN = evidenceLinkCount > 0 ? evidenceLinkCountForSkeletonNode(n.nodeId, resolvedEvidenceLinks) : 0;
                    return (
                      <li key={n.nodeId} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs">
                        <span className="font-medium text-white">{n.labelIt}</span>
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide ${
                            n.observability === "high"
                              ? "bg-emerald-500/20 text-emerald-200"
                              : n.observability === "partial"
                                ? "bg-amber-500/20 text-amber-200"
                                : "bg-rose-500/20 text-rose-200"
                          }`}
                        >
                          {n.observability}
                        </span>
                        {dbN > 0 ? (
                          <span
                            className="ml-2 inline-flex items-center rounded border border-orange-500/35 bg-orange-500/10 px-1.5 py-0.5 font-mono text-[0.6rem] text-orange-200/95"
                            title="Almeno un link assi–fluidi in banco mappato a questo nodo (curato DB)"
                          >
                            DB {dbN}
                          </span>
                        ) : null}
                        <p className="mt-1 text-gray-400">{n.rationaleIt}</p>
                      </li>
                    );
                  })}
                </ul>
                <details className="mt-4 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-gray-500">
                  <summary className="cursor-pointer text-gray-300">Archi canonic (v1, in espansione)</summary>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[0.65rem] leading-snug">
                    {vm.interactionSkeleton.edges.map((e, i) => {
                      const dbE =
                        evidenceLinkCount > 0 ? evidenceLinkCountForSkeletonEdge(e.from, e.to, resolvedEvidenceLinks) : 0;
                      return (
                        <li key={`${e.from}-${e.to}-${i}`} className="font-mono text-gray-400">
                          <span className="text-fuchsia-200/90">{e.from}</span> → <span className="text-violet-200/90">{e.to}</span>
                          {dbE > 0 ? (
                            <span className="ml-2 inline-block rounded border border-orange-500/35 bg-orange-500/10 px-1 font-mono text-[0.6rem] text-orange-200/95">
                              DB {dbE}
                            </span>
                          ) : null}
                          <span className="mt-0.5 block text-gray-500">{e.mechanismIt}</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </Pro2SectionCard>
              </div>
            ) : null}

            {vm.biaLiteratureSummary ? (
              <Pro2SectionCard
                accent="violet"
                title="BIA · modello letteratura (v1)"
                subtitle={`Prior deterministico · confidenza ${Math.round(vm.biaLiteratureSummary.confidence01 * 100)}% · non diagnosi clinica`}
                icon={Activity}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-violet-200/90">Geometria (PhA)</p>
                    <p className="mt-1 text-sm text-white">{biaCellularBandIt(vm.biaLiteratureSummary.cellularGeometry.band)}</p>
                    <p className="mt-1 font-mono text-xs text-gray-400">
                      supportIndex01={vm.biaLiteratureSummary.cellularGeometry.supportIndex01.toFixed(2)}
                      {vm.biaLiteratureSummary.cellularGeometry.phaseAngleDegUsed != null
                        ? ` · PhA ${vm.biaLiteratureSummary.cellularGeometry.phaseAngleDegUsed.toFixed(1)}°`
                        : null}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-orange-200/90">Comparti fluidi (ECW/TBW)</p>
                    <p className="mt-1 text-sm text-white">{biaFluidBandIt(vm.biaLiteratureSummary.extracellularFluid.band)}</p>
                    <p className="mt-1 font-mono text-xs text-gray-400">
                      loadBias01={vm.biaLiteratureSummary.extracellularFluid.loadBias01.toFixed(2)}
                      {vm.biaLiteratureSummary.extracellularFluid.ecwTbwRatioUsed != null
                        ? ` · ratio ${vm.biaLiteratureSummary.extracellularFluid.ecwTbwRatioUsed.toFixed(3)}`
                        : null}
                    </p>
                  </div>
                </div>
                <details className="mt-4 text-xs text-gray-400">
                  <summary className="cursor-pointer text-violet-200/90">Disclaimer e ancore metodologiche</summary>
                  <ul className="mt-2 space-y-2">
                    {vm.biaLiteratureSummary.disclaimersIt.map((d) => (
                      <li key={d} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-gray-300">
                        {d}
                      </li>
                    ))}
                    {vm.biaLiteratureSummary.literatureAnchorsIt.map((a) => (
                      <li key={a} className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-2 py-1.5 text-gray-300">
                        {a}
                      </li>
                    ))}
                  </ul>
                </details>
              </Pro2SectionCard>
            ) : null}

            {vm.evidenceConditionedLayer && evidenceLinkCount > 0 ? (
              <div id="bioenergetic-evidence-layer" className="scroll-mt-24">
              <Pro2SectionCard
                accent="orange"
                title="Evidenza letteratura · assi e fluidi"
                subtitle={`Banco ${vm.evidenceConditionedLayer.bankRef.bankId} · ${vm.evidenceConditionedLayer.bankRef.bankVersion} · ${evidenceLinkCount} link · badge «DB» nel grafo skeleton = link mappati a quel contesto`}
                icon={BookOpen}
              >
                <p className="mb-2 text-[0.7rem] text-orange-200/85">
                  <a
                    href="#bioenergetic-skeleton-layer"
                    className="underline decoration-orange-400/50 underline-offset-2 hover:text-orange-100"
                  >
                    Torna al grafo skeleton
                  </a>
                </p>
                <p className="text-sm leading-relaxed text-gray-300">
                  Grafo curato (ormoni / neuro / renale ↔ processi di fluido). Serve al synthesizer evidenza e alla UI
                  «perché»; le curve sopra restano kernel / misura.
                </p>
                <ul className="mt-3 space-y-2 text-xs text-gray-400">
                  {vm.evidenceConditionedLayer.disclaimersIt.map((d) => (
                    <li key={d} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-gray-300">
                      {d}
                    </li>
                  ))}
                </ul>
                {vm.evidenceConditionedLayer.series.length > 0 ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-orange-200/85">
                      Serie evidenza condizionata (24 h, indice 0–100)
                    </p>
                    <ul className="mt-2 space-y-2">
                      {vm.evidenceConditionedLayer.series.map((s) => {
                        const lo = Math.min(...s.hourlyMean24);
                        const hi = Math.max(...s.hourlyMean24);
                        return (
                          <li
                            key={s.analyteId}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs text-gray-300"
                          >
                            <span className="font-mono text-orange-200/90">{s.analyteId}</span> · {s.unit} · fascia{" "}
                            {lo.toFixed(1)}–{hi.toFixed(1)}
                            <span className="mt-1 block truncate font-mono text-[0.6rem] text-gray-500">
                              digest contesto {s.contextDigest.slice(0, 14)}…
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {vm.evidenceConditionedLayer.contributionGraph ? (
                  <details className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium text-orange-200/90">
                      Grafo contributi ({vm.evidenceConditionedLayer.contributionGraph.edges.length} archi,{" "}
                      {vm.evidenceConditionedLayer.contributionGraph.nodes.length} nodi)
                    </summary>
                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[0.65rem] text-gray-500">
                      {vm.evidenceConditionedLayer.contributionGraph.edges.map((e, i) => (
                        <li key={`${e.from}-${e.to}-${i}`} className="font-mono">
                          {e.from} → {e.to}
                          {e.weight01 != null ? ` · w ${e.weight01.toFixed(2)}` : ""}
                          {e.evidenceLinkId ? ` · link ${e.evidenceLinkId.slice(0, 8)}…` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <details className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium text-orange-200/95">
                    Mostra link ({evidenceLinkCount})
                  </summary>
                  <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                    {resolvedEvidenceLinks.map((lk) => (
                      <li key={lk.linkId} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                        <p className="text-[0.65rem] font-mono uppercase tracking-wide text-orange-300/90">
                          {lk.axis.labelIt} → {lk.fluidProcess.labelIt}
                        </p>
                        <p className="mt-1 text-[0.7rem] text-gray-500">
                          {lk.relationKind} · {lk.strength}
                          {lk.ontologyRefs?.length ? ` · ontology ${lk.ontologyRefs.length}` : null}
                        </p>
                        <p className="mt-1 text-xs leading-snug text-gray-300">{lk.narrativeIt}</p>
                        {lk.documents.length ? (
                          <p className="mt-1 text-[0.65rem] text-gray-500">
                            Fonti:{" "}
                            {lk.documents
                              .map((doc) => `${doc.sourceDb}:${doc.externalId}`)
                              .slice(0, 4)
                              .join(" · ")}
                            {lk.documents.length > 4 ? ` · +${lk.documents.length - 4}` : ""}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              </Pro2SectionCard>
              </div>
            ) : vm ? (
              <Pro2SectionCard accent="slate" title="Evidenza letteratura · assi e fluidi" subtitle="Nessun link caricato" icon={BookOpen}>
                <p className="text-sm text-gray-400">
                  Il layer opzionale è vuoto se le migrazioni <code className="text-gray-300">051</code> /{" "}
                  <code className="text-gray-300">052</code> non sono sul progetto Supabase collegato, oppure se la query fallisce
                  (permessi). Con seed applicato dovresti vedere <strong className="text-white">8</strong> link e la tile arancione con
                  conteggio.
                </p>
              </Pro2SectionCard>
            ) : null}

            <Pro2SectionCard accent="amber" title="Segnali & biomarker" subtitle="Da lab e canali del giorno; assenza dati non implica valore clinico" icon={LineChart}>
              {(() => {
                const tiles = vm.metricTiles ?? [];
                const byCat = tiles.reduce<Record<string, BioenergeticMetricTile[]>>((acc, t) => {
                  const k = t.category;
                  if (!acc[k]) acc[k] = [];
                  acc[k].push(t);
                  return acc;
                }, {});
                const order: BioenergeticMetricTileCategory[] = [
                  "metabolic",
                  "inflammatory",
                  "hormonal",
                  "neural",
                  "gastro_intestinal",
                  "gonadal",
                ];
                return (
                  <div className="space-y-6">
                    {order.map((cat) => {
                      const list = byCat[cat];
                      if (!list?.length) return null;
                      return (
                        <div key={cat}>
                          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-amber-200/90">
                            {CATEGORY_LABEL[cat]}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {list.map((t) => (
                              <div
                                key={t.id}
                                className={`rounded-2xl border px-3 py-2.5 ${impactTileClass(t.impact)}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-medium leading-snug text-white">{t.labelIt}</p>
                                  <span className="shrink-0 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-gray-400">
                                    {provenanceLabel(t.provenance)}
                                  </span>
                                </div>
                                <p className="mt-1 font-mono text-lg font-semibold text-white">{t.displayValue}</p>
                                <p className="text-[0.65rem] text-gray-500">{t.unit}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Pro2SectionCard>

            <Pro2SectionCard accent="cyan" title="Kernel v1" subtitle="Contrasto domanda energetica vs esposizione CHO" icon={Activity}>
              <p className="text-sm text-gray-300">
                Glucose handling {vm.kernel.glucoseHandlingScore} · Insulin demand {vm.kernel.insulinDemandScore} ·
                Oxidation drive {vm.kernel.oxidationDriveScore}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {vm.kernel.keyDrivers.map((d) => (
                  <span key={d} className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-gray-300">
                    {d}
                  </span>
                ))}
              </div>
            </Pro2SectionCard>
          </>
        ) : null}
      </section>

      <section id="gen-cross" className="scroll-mt-28">
        {vm?.interpretationHints?.length ? (
          <Pro2SectionCard accent="violet" title="Interpretation" subtitle="Hint multiscala (non diagnostici)" icon={LineChart}>
            <div className="space-y-2">
              {vm.interpretationHints.map((h) => (
                <div key={h.pathwayId} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-sm font-semibold text-white">{h.title}</p>
                  <p className="text-xs text-gray-400">{h.detail}</p>
                </div>
              ))}
            </div>
          </Pro2SectionCard>
        ) : null}
      </section>

      <section id="gen-focus" className="scroll-mt-28">
        <Pro2SectionCard accent="rose" title="Disclaimers" subtitle="Sicurezza interpretativa" icon={Activity}>
          <ul className="space-y-2 text-sm text-gray-300">
            {(vm?.disclaimers ?? ["Nessuna nota disponibile."]).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Pro2SectionCard>
      </section>
    </Pro2ModulePageShell>
  );
}
