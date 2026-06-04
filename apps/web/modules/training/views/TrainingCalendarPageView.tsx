"use client";

import type { ExecutedWorkout, PlannedWorkout } from "@empathy/domain-training";
import { formatExecutedWorkoutSummary } from "@empathy/domain-training";
import { Activity, CalendarDays, FileUp, Heart, LayoutGrid, LineChart, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDaySessionDetail } from "@/components/training/CalendarDaySessionDetail";
import { CalendarDayWellnessDetail } from "@/components/training/CalendarDayWellnessDetail";
import { CalendarPlannedBuilderDetail } from "@/components/training/CalendarPlannedBuilderDetail";
import { CoachWorkoutLibraryPanel } from "@/components/training/CoachWorkoutLibraryPanel";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { TrainingViryaActivePlanStrip } from "@/components/training/TrainingViryaActivePlanStrip";
import { TrainingCalendarAnalyzer } from "@/components/training/TrainingCalendarAnalyzer";
import { TrainingPeriodVolumeSummary } from "@/components/training/TrainingPeriodVolumeSummary";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { normalizeDateKey, traceRecord, workoutDayKey } from "@/lib/training/calendar-analyzer-helpers";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import { resolveExecutedTrainingLoad } from "@/lib/training/infer-executed-training-load";
import { LOAD_CHIP_LABEL } from "@/lib/training/load-metrics-labels";
import {
  plannedCalendarChipViewModel,
  uniquePlannedSportGlyphs,
} from "@/lib/training/planned-workout-display";
import { isViryaPlannedWorkout } from "@/lib/training/virya/virya-planned-notes";
import { useAthleteFtpWatts } from "@/lib/training/physiology/use-athlete-ftp-watts";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { useIsMobileApp, useProductHref } from "@/lib/shell/use-product-href";
import type { TrainingPlannedWindowOkViewModel, TrainingTwinContextStripViewModel } from "@/api/training/contracts";
import type { WellnessByDateMap } from "@/lib/physiology/wellness-window-summary";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import {
  fetchPlannedWindowCached,
  invalidatePlannedWindowCacheForAthlete,
} from "@/lib/training/planned-window-client-cache";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import { importExecutedWorkoutFile, importPlannedProgramFile } from "@/modules/training/services/training-import-api";
import {
  deletePlannedWorkoutsOnDate,
  deleteViryaCalendarPlan,
  fetchViryaCalendarPlans,
  patchPlannedWorkout,
  type ViryaCalendarPlanSummary,
} from "@/modules/training/services/training-planned-api";
import {
  activeViryaCalendarTombstones,
  clearViryaCalendarTombstone,
} from "@/lib/training/virya/virya-calendar-tombstone";

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Sposta una chiave YYYY-MM-DD di `delta` giorni (mezzogiorno locale → evita salti fusi). */
function addDaysToIsoDateKey(isoDay: string, deltaDays: number): string {
  const key = isoDay.slice(0, 10);
  const base = new Date(`${key}T12:00:00`);
  if (Number.isNaN(base.getTime())) return key;
  base.setDate(base.getDate() + deltaDays);
  return toDateKey(base);
}

/** Confronto solo giorni `YYYY-MM-DD` (stringa ISO, fuso mezzogiorno già applicato altrove). */
function minIsoDay(a: string, b: string): string {
  return a <= b ? a : b;
}
function maxIsoDay(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * La griglia resta sul mese visibile, ma il fetch allarga la finestra (come il Builder):
 * evita sedute “perdute” ai bordi e allinea i dati alla lista “Prossime pianificate”.
 */
function calendarPlannedFetchBounds(monthStart: Date, monthEnd: Date): {
  monthFrom: string;
  monthTo: string;
  fetchFrom: string;
  fetchTo: string;
} {
  const monthFrom = toDateKey(monthStart);
  const monthTo = toDateKey(monthEnd);
  /** Griglia: mese visibile + margine breve (drag / bordi). Evita ±45g con trace_summary enormi. */
  const fetchFrom = addDaysToIsoDateKey(monthFrom, -7);
  const fetchTo = addDaysToIsoDateKey(monthTo, 7);
  return { monthFrom, monthTo, fetchFrom, fetchTo };
}

function mergeExecutedForDay(
  prev: ExecutedWorkout[],
  dayKey: string,
  dayRows: ExecutedWorkout[],
): ExecutedWorkout[] {
  const rest = prev.filter((w) => normalizeDateKey(workoutDayKey(w)) !== dayKey);
  return [...rest, ...dayRows].sort((a, b) => workoutDayKey(a).localeCompare(workoutDayKey(b)));
}

function mergePlannedForDay(prev: PlannedWorkout[], dayKey: string, dayRows: PlannedWorkout[]): PlannedWorkout[] {
  const rest = prev.filter((w) => normalizeDateKey(w.date) !== dayKey);
  return [...rest, ...dayRows].sort((a, b) => normalizeDateKey(a.date).localeCompare(normalizeDateKey(b.date)));
}

function normalizeIsoDateParam(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;

const PLANNED_DRAG_MIME = "application/x-empathy-planned-workout";

type PlannedDragPayload = { id: string; fromDate: string };

function readPlannedDragPayload(dataTransfer: DataTransfer | null): PlannedDragPayload | null {
  if (!dataTransfer) return null;
  const raw = dataTransfer.getData(PLANNED_DRAG_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PlannedDragPayload;
    if (typeof parsed.id !== "string" || !parsed.id.trim()) return null;
    const fromDate = normalizeDateKey(parsed.fromDate);
    if (!fromDate) return null;
    return { id: parsed.id.trim(), fromDate };
  } catch {
    return null;
  }
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickMetric(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const k of keys) {
    const value = num(trace[k]);
    if (value != null) return value;
  }
  return null;
}

function pickText(trace: Record<string, unknown> | null, keys: string[]): string | null {
  if (!trace) return null;
  for (const k of keys) {
    const v = trace[k];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return null;
}

function sportIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("run")) return "run";
  if (t.includes("bike") || t.includes("cycl")) return "bike";
  if (t.includes("swim")) return "swim";
  if (t.includes("gym") || t.includes("strength")) return "strength";
  return "generic";
}

/** Stesse icone compatte della calendar V1 (`SportGlyph`). */
function SportGlyph({ type }: { type: string }) {
  const icon = sportIcon(type);
  const common = {
    viewBox: "0 0 24 24",
    width: 14,
    height: 14,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (icon === "run")
    return (
      <svg {...common}>
        <circle cx="17" cy="5" r="2" />
        <path d="M9 18l3-6 2 2 4 2" />
        <path d="M12 11l1-4 4 1" />
        <path d="M6 22l3-5" />
      </svg>
    );
  if (icon === "bike")
    return (
      <svg {...common}>
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path d="M6 17l4-6h4l4 6" />
        <path d="M10 11l-2-3" />
      </svg>
    );
  if (icon === "swim")
    return (
      <svg {...common}>
        <path d="M3 15c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0" />
        <path d="M8 10l3-2 3 2" />
        <path d="M12 8V5" />
      </svg>
    );
  if (icon === "strength")
    return (
      <svg {...common}>
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="M6 10v4" />
        <path d="M18 10v4" />
        <path d="M8 12h8" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M13 2L3 14h8l-1 8 10-12h-8z" />
    </svg>
  );
}

export default function TrainingCalendarPageView() {
  const searchParams = useSearchParams();
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [calendarReady, setCalendarReady] = useState(false);
  const athleteFtpWatts = useAthleteFtpWatts(calendarReady ? athleteId : null);

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const isMobileApp = useIsMobileApp();
  const selectedSessionHref = useProductHref(`/training/session/${selectedDate}`);

  useEffect(() => {
    const q = normalizeIsoDateParam(searchParams.get("date"));
    if (q) {
      setSelectedDate(q);
      const parsed = new Date(`${q}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        setMonthCursor(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      }
    }
  }, [searchParams]);

  const monthStart = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1), [monthCursor]);
  const monthEnd = useMemo(() => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0), [monthCursor]);
  const monthStartWeekdayMonday = useMemo(() => (monthStart.getDay() + 6) % 7, [monthStart]);
  const daysInMonth = monthEnd.getDate();

  const [loading, setLoading] = useState(true);
  const [monthRefreshing, setMonthRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [planned, setPlanned] = useState<PlannedWorkout[]>([]);
  const [executed, setExecuted] = useState<ExecutedWorkout[]>([]);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [twinContextStrip, setTwinContextStrip] = useState<TrainingTwinContextStripViewModel | null>(null);
  const [plannedProvenanceSummary, setPlannedProvenanceSummary] = useState<Partial<Record<string, number>> | null>(null);
  const [wellnessByDate, setWellnessByDate] = useState<WellnessByDateMap>({});
  const [showFileImport, setShowFileImport] = useState(false);
  const [fileImportForm, setFileImportForm] = useState({
    mode: "auto" as "auto" | "executed" | "planned",
    date: "",
    device: "auto",
    notes: "",
    file: null as File | null,
    /** Solo modalità planned: se l’API programmato fallisce, importa lo stesso file come eseguito (traccia → Analyzer). */
    fallbackExecutedOnPlannedError: false,
  });
  /** Solo per confronto oggettivo con Builder (stesso endpoint): HTTP + conteggi risposta. */
  const [fetchDiag, setFetchDiag] = useState<{
    status: number;
    plannedN: number;
    executedN: number;
    executedFallback?: boolean;
    executedHiddenByPreference?: number;
    sampleDates?: string[];
    apiError?: string;
    resFrom?: string;
    resTo?: string;
  } | null>(null);

  const { monthFrom, monthTo, fetchFrom, fetchTo } = useMemo(
    () => calendarPlannedFetchBounds(monthStart, monthEnd),
    [monthStart, monthEnd],
  );

  /**
   * Evita che risposte `planned-window` più lente sovrascrivano una lettura più recente
   * (es. dopo elimina seduta: due fetch in parallelo → la vecchia ripristina la riga).
   */
  const plannedWindowFetchGenRef = useRef(0);
  const selectedDayFetchGenRef = useRef(0);
  const calendarReadyRef = useRef(false);
  const lastVisibilityRefreshAtRef = useRef(0);
  /** Id eliminati in-sessione: filtra fetch stale che ripresentano la riga prima che il DB sia allineato. */
  const locallyRemovedPlannedIdsRef = useRef<Set<string>>(new Set());
  const [viryaReappearWarning, setViryaReappearWarning] = useState<string | null>(null);
  const [dayDeleteAllBusy, setDayDeleteAllBusy] = useState(false);
  const [dayDeleteAllConfirm, setDayDeleteAllConfirm] = useState(false);
  const [dragPlannedId, setDragPlannedId] = useState<string | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [movePlannedBusyId, setMovePlannedBusyId] = useState<string | null>(null);
  /** Blocca merge stale del fetch giorno (250ms) durante drag/PATCH — evita revert su swap 05↔06. */
  const plannedMoveInFlightRef = useRef(0);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const calendarEnrichmentGenRef = useRef(0);
  const [belowFoldReady, setBelowFoldReady] = useState(false);
  const [viryaPlans, setViryaPlans] = useState<ViryaCalendarPlanSummary[] | null>(null);
  const [viryaPlansLoadErr, setViryaPlansLoadErr] = useState<string | null>(null);
  const [viryaPlansLoading, setViryaPlansLoading] = useState(false);

  useEffect(() => {
    setDayDeleteAllConfirm(false);
  }, [selectedDate]);

  /** Cambio atleta: non mostrare griglia con dati del profilo precedente finché non arriva il nuovo fetch. */
  useEffect(() => {
    calendarReadyRef.current = false;
    setCalendarReady(false);
    setExecuted([]);
    setPlanned([]);
    setWellnessByDate({});
    setReadSpineCoverage(null);
    setTwinContextStrip(null);
    setFetchDiag(null);
    setBelowFoldReady(false);
    setViryaPlans(null);
    setViryaPlansLoadErr(null);
    setViryaPlansLoading(false);
    postGridEnrichedDayRef.current = null;
  }, [athleteId]);
  /** Evita doppio POST import (doppio click / StrictMode) che crea righe PLAN duplicate. */
  const trainingImportInFlightRef = useRef(false);

  /** Tick per forzare rifetch del dettaglio del giorno selezionato anche se `selectedDate`
   *  non cambia (es. import su stesso giorno gia' selezionato → la cella mostrava ancora
   *  i dati Fase 1 senza trace_summary aggiornato). */
  const [selectedDayRefreshTick, setSelectedDayRefreshTick] = useState(0);
  /** Giorno già arricchito dal pipeline post-griglia (evita doppio fetch trace al first paint). */
  const postGridEnrichedDayRef = useRef<string | null>(null);

  const mergeSelectedDayFromWindow = useCallback(
    async (dayKey: string, fetchGen: number, scope: "grid" | "selected") => {
      const isStale = () =>
        scope === "grid"
          ? fetchGen !== plannedWindowFetchGenRef.current
          : fetchGen !== selectedDayFetchGenRef.current;
      if (!athleteId || plannedMoveInFlightRef.current > 0) return;
      try {
        const q = new URLSearchParams({
          athleteId,
          from: dayKey,
          to: dayKey,
          includeAthleteContext: "0",
          includeTraceSummary: "1",
          includePlannedNotes: "1",
        });
        const url = `/api/training/planned-window?${q}`;
        const cached = await fetchPlannedWindowCached<
          TrainingPlannedWindowOkViewModel | { ok: false; error?: string }
        >(url, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        if (isStale()) return;
        if (!cached.ok || !cached.json.ok) return;
        if (plannedMoveInFlightRef.current > 0) return;
        const day = cached.json as TrainingPlannedWindowOkViewModel;
        setExecuted((prev) => mergeExecutedForDay(prev, dayKey, day.executed ?? []));
        setPlanned((prev) => mergePlannedForDay(prev, dayKey, day.planned ?? []));
      } catch {
        /* best-effort */
      }
    },
    [athleteId],
  );

  /**
   * Dopo la griglia PLAN visibile: una chiamata alla volta (EXEC device → wellness → VIRYA).
   * Notes builder del giorno: solo al cambio data / pannello sotto (mergeSelectedDayFromWindow).
   */
  const runPostGridEnrichment = useCallback(
    async (gridFetchGen: number) => {
      const enrichGen = ++calendarEnrichmentGenRef.current;
      const isEnrichStale = () => enrichGen !== calendarEnrichmentGenRef.current;
      const isGridStale = () => gridFetchGen !== plannedWindowFetchGenRef.current;
      if (!athleteId) return;

      setBelowFoldReady(false);
      setViryaPlansLoading(true);
      setViryaPlansLoadErr(null);

      try {
        const authHeaders = await buildSupabaseAuthHeaders();
        const qExec = new URLSearchParams({
          athleteId,
          from: fetchFrom,
          to: fetchTo,
          includePlanned: "0",
          includeExecuted: "1",
          includeAthleteContext: "0",
          includeTraceSummary: "0",
          includePlannedNotes: "0",
        });
        const execUrl = `/api/training/planned-window?${qExec}`;
        const execCached = await fetchPlannedWindowCached<
          TrainingPlannedWindowOkViewModel | { ok: false; error?: string }
        >(execUrl, {
          cache: "no-store",
          credentials: "same-origin",
          headers: authHeaders,
        });
        if (isEnrichStale() || isGridStale()) return;
        if (execCached.ok && execCached.json.ok) {
          const core = execCached.json as TrainingPlannedWindowOkViewModel;
          setExecuted(core.executed ?? []);
          setFetchDiag((prev) =>
            prev
              ? {
                  ...prev,
                  executedN: core.executed?.length ?? 0,
                  executedFallback: core.executedAdminFallbackUsed ?? false,
                  executedHiddenByPreference: core.executedHiddenBySourcePreference ?? 0,
                  sampleDates: Array.isArray(core.executedSampleDates) ? core.executedSampleDates : prev.sampleDates,
                }
              : prev,
          );
        }
      } catch {
        /* eseguiti opzionali */
      }

      if (isEnrichStale() || isGridStale()) return;

      try {
        const authHeaders = await buildSupabaseAuthHeaders();
        const q = new URLSearchParams({
          athleteId,
          from: fetchFrom,
          to: fetchTo,
          includeWellness: "1",
          includePlanned: "0",
          includeExecuted: "0",
          includeAthleteContext: "0",
          includeTraceSummary: "0",
          includePlannedNotes: "0",
        });
        const url = `/api/training/planned-window?${q}`;
        const cached = await fetchPlannedWindowCached<
          TrainingPlannedWindowOkViewModel | { ok: false; error?: string }
        >(url, {
          cache: "no-store",
          credentials: "same-origin",
          headers: authHeaders,
        });
        if (isEnrichStale() || isGridStale()) return;
        if (cached.ok && cached.json.ok) {
          setWellnessByDate((cached.json as TrainingPlannedWindowOkViewModel).wellnessByDate ?? {});
        }
      } catch {
        /* wellness opzionale */
      }

      if (isEnrichStale() || isGridStale()) return;

      try {
        const plans = await fetchViryaCalendarPlans(athleteId);
        if (isEnrichStale() || isGridStale()) return;
        setViryaPlans(plans);
        const tombs = activeViryaCalendarTombstones(athleteId);
        for (const t of tombs) {
          if (plans.some((p) => p.tag === t.tag)) {
            await deleteViryaCalendarPlan({ athleteId, tag: t.tag });
          } else {
            clearViryaCalendarTombstone(athleteId, t.tag);
          }
        }
      } catch (e) {
        if (!isEnrichStale()) {
          setViryaPlansLoadErr(e instanceof Error ? e.message : "Errore piani VIRYA");
          setViryaReappearWarning(
            e instanceof Error
              ? `Piano VIRYA eliminato in precedenza ma ancora presente sul server: ${e.message}`
              : "Piano VIRYA eliminato in precedenza ma ancora presente sul server.",
          );
        }
      } finally {
        if (!isEnrichStale()) setViryaPlansLoading(false);
      }

      if (isEnrichStale() || isGridStale()) return;
      setBelowFoldReady(true);
    },
    [athleteId, fetchFrom, fetchTo],
  );

  const loadMonth = useCallback(
    async (opts?: { anchorDay?: string }) => {
    /** Con `athleteId` già noto non bloccare: altrimenti dopo delete il refresh può saltare e la UI resta su dati vecchi. */
    if (ctxLoading && !athleteId) return;
    const fetchGen = ++plannedWindowFetchGenRef.current;
    const isStale = () => fetchGen !== plannedWindowFetchGenRef.current;

    if (!athleteId) {
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setPlannedProvenanceSummary(null);
      setErr("Nessun atleta attivo.");
      setLoading(false);
      calendarReadyRef.current = false;
      setCalendarReady(false);
      setMonthRefreshing(false);
      return;
    }
    if (calendarReadyRef.current) {
      setMonthRefreshing(true);
    } else {
      setLoading(true);
    }
    setErr(null);
    setBelowFoldReady(false);
    if (opts?.anchorDay?.trim()) {
      invalidatePlannedWindowCacheForAthlete(athleteId);
    }
    try {
      let from = fetchFrom;
      let to = fetchTo;
      const anchorRaw = opts?.anchorDay?.trim() ?? "";
      const anchor = anchorRaw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
      if (anchor) {
        /** Dopo import la `loadMonth` può girare prima che React aggiorni `monthCursor` → finestra mensile troppo stretta; forziamo inclusione del giorno salvato. */
        const padFrom = addDaysToIsoDateKey(anchor, -14);
        const padTo = addDaysToIsoDateKey(anchor, 14);
        from = minIsoDay(from, padFrom);
        to = maxIsoDay(to, padTo);
      }
      const authHeaders = await buildSupabaseAuthHeaders();
      const fetchPlannedWindow = async (q: URLSearchParams) => {
        const url = `/api/training/planned-window?${q}`;
        const cached = await fetchPlannedWindowCached<
          TrainingPlannedWindowOkViewModel | { ok: false; error?: string }
        >(url, {
          cache: "no-store",
          credentials: "same-origin",
          headers: authHeaders,
        });
        const res = { ok: cached.ok, status: cached.status } as Response;
        return { res, json: cached.json };
      };

      /** Step 1 — chip PLAN in cella (solo `planned_workouts`, lite). */
      const qPlan = new URLSearchParams({ athleteId, from, to });
      qPlan.set("includePlanned", "1");
      qPlan.set("includeExecuted", "0");
      qPlan.set("includeAthleteContext", "0");
      qPlan.set("includeTraceSummary", "0");
      qPlan.set("includePlannedNotes", "0");
      const { res, json } = await fetchPlannedWindow(qPlan);
      if (isStale()) return;

      if (!res.ok || !json.ok) {
        setPlanned([]);
        setExecuted([]);
        setReadSpineCoverage(null);
        setTwinContextStrip(null);
        setPlannedProvenanceSummary(null);
        setWellnessByDate({});
        setFetchDiag({
          status: res.status,
          plannedN: 0,
          executedN: 0,
          apiError: ("error" in json && json.error) || res.statusText,
        });
        setErr(("error" in json && json.error) || "Lettura calendario non riuscita.");
        return;
      }
      const core = json as TrainingPlannedWindowOkViewModel;
      const p = core.planned ?? [];
      const removed = locallyRemovedPlannedIdsRef.current;
      const stillPresent = p.filter((row) => removed.has(row.id));
      if (stillPresent.length > 0) {
        setViryaReappearWarning(
          `Il server ha ancora ${stillPresent.length} seduta/e appena eliminate (id duplicato o refresh in ritardo). Usa «Tutto il piano VIRYA» se è un piano annuale, oppure attendi e riprova.`,
        );
      } else {
        setViryaReappearWarning(null);
        for (const id of removed) {
          if (!p.some((row) => row.id === id)) removed.delete(id);
        }
      }
      setPlanned(p.filter((row) => !removed.has(row.id)));
      setExecuted([]);
      setPlannedProvenanceSummary(core.plannedProvenanceSummary ?? null);
      setFetchDiag({
        status: res.status,
        plannedN: p.length,
        executedN: 0,
        executedFallback: false,
        executedHiddenByPreference: 0,
        sampleDates: [],
        resFrom: core.from,
        resTo: core.to,
      });
    } catch {
      if (isStale()) return;
      setErr("Errore di rete.");
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setPlannedProvenanceSummary(null);
      setWellnessByDate({});
      setFetchDiag({ status: 0, plannedN: 0, executedN: 0, apiError: "network" });
    } finally {
      if (!isStale()) {
        setLoading(false);
        setMonthRefreshing(false);
        calendarReadyRef.current = true;
        setCalendarReady(true);
        const gridGen = fetchGen;
        window.setTimeout(() => {
          void runPostGridEnrichment(gridGen);
        }, 0);
      }
    }
  },
  [athleteId, ctxLoading, fetchFrom, fetchTo, runPostGridEnrichment],
);

  /**
   * Dettaglio giorno (notes builder + trace): solo dopo la coda EXEC → wellness → VIRYA,
   * così non compete con la griglia né duplica il primo paint.
   */
  useEffect(() => {
    if (!athleteId || ctxLoading || !calendarReady || !selectedDate || !belowFoldReady) return;
    const fetchGen = ++selectedDayFetchGenRef.current;
    const timer = window.setTimeout(() => {
      void mergeSelectedDayFromWindow(selectedDate, fetchGen, "selected").then(() => {
        if (fetchGen === selectedDayFetchGenRef.current) {
          postGridEnrichedDayRef.current = selectedDate;
        }
      });
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    athleteId,
    ctxLoading,
    calendarReady,
    belowFoldReady,
    selectedDate,
    selectedDayRefreshTick,
    mergeSelectedDayFromWindow,
  ]);

  const movePlannedWorkoutToDate = useCallback(
    async (workoutId: string, fromDate: string, toDate: string) => {
      const targetDate = normalizeDateKey(toDate);
      const sourceDate = normalizeDateKey(fromDate);
      if (!athleteId || !targetDate || !sourceDate || workoutId.trim() === "") return;
      if (targetDate === sourceDate) return;
      if (plannedMoveInFlightRef.current > 0) {
        setErr("Attendi il termine dello spostamento precedente, poi riprova.");
        return;
      }

      plannedMoveInFlightRef.current += 1;
      setMovePlannedBusyId(workoutId);
      setErr(null);
      setSuccess(null);
      const previous = planned;
      setPlanned((prev) =>
        prev.map((w) => (w.id === workoutId ? { ...w, date: targetDate } : w)),
      );
      setSelectedDate(targetDate);
      const targetMonth = new Date(`${targetDate}T12:00:00`);
      if (!Number.isNaN(targetMonth.getTime())) {
        setMonthCursor(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1));
      }

      try {
        await patchPlannedWorkout({
          id: workoutId,
          athleteId,
          patch: { date: targetDate },
        });
        setSuccess(`Seduta spostata al ${targetDate}.`);
        invalidatePlannedWindowCacheForAthlete(athleteId);
        await loadMonth({ anchorDay: targetDate });
        setSelectedDayRefreshTick((t) => t + 1);
      } catch (e) {
        setPlanned(previous);
        setErr(e instanceof Error ? e.message : "Spostamento seduta non riuscito");
        invalidatePlannedWindowCacheForAthlete(athleteId);
        await loadMonth({ anchorDay: sourceDate });
        setSelectedDayRefreshTick((t) => t + 1);
      } finally {
        plannedMoveInFlightRef.current = Math.max(0, plannedMoveInFlightRef.current - 1);
        setMovePlannedBusyId(null);
        setDragPlannedId(null);
        setDropTargetDate(null);
      }
    },
    [athleteId, loadMonth, planned],
  );

  useEffect(() => {
    const urlDay = normalizeIsoDateParam(searchParams.get("date")) ?? undefined;
    postGridEnrichedDayRef.current = null;
    void loadMonth(urlDay ? { anchorDay: urlDay } : undefined);
  }, [athleteId, loadMonth, searchParams]);

  /** Dopo salvataggio in Builder (altra tab) o ritorno alla pagina: ricarica finestra (debounced). */
  useEffect(() => {
    if (!athleteId || ctxLoading) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisibilityRefreshAtRef.current < 12_000) return;
      lastVisibilityRefreshAtRef.current = now;
      invalidatePlannedWindowCacheForAthlete(athleteId);
      void loadMonth({ anchorDay: selectedDate });
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [athleteId, ctxLoading, selectedDate, loadMonth]);

  const plannedByDate = useMemo(() => {
    const m = new Map<string, PlannedWorkout[]>();
    for (const w of planned) {
      const key = normalizeDateKey(w.date);
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(w);
      m.set(key, arr);
    }
    return m;
  }, [planned]);

  const executedByDate = useMemo(() => {
    const m = new Map<string, ExecutedWorkout[]>();
    for (const w of executed) {
      const key = normalizeDateKey(workoutDayKey(w));
      if (!key) continue;
      const arr = m.get(key) ?? [];
      arr.push(w);
      m.set(key, arr);
    }
    return m;
  }, [executed]);

  const monthlySessionCount = useMemo(() => {
    const inMonth = (dayKey: string) => dayKey >= monthFrom && dayKey <= monthTo;
    const p = planned.filter((w) => inMonth(normalizeDateKey(w.date))).length;
    const e = executed.filter((w) => inMonth(normalizeDateKey(workoutDayKey(w)))).length;
    return p + e;
  }, [planned, executed, monthFrom, monthTo]);

  const monthDayKeys = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    });
  }, [daysInMonth, monthStart]);

  const monthExecutedRows = useMemo(() => {
    return executed.filter((w) => {
      const key = normalizeDateKey(workoutDayKey(w));
      return key >= monthFrom && key <= monthTo;
    });
  }, [executed, monthFrom, monthTo]);

  const monthExecutedRenderedCount = useMemo(() => {
    return monthDayKeys.reduce((acc, key) => acc + (executedByDate.get(key)?.length ?? 0), 0);
  }, [monthDayKeys, executedByDate]);

  const executedCalendarGap = useMemo(() => {
    if (monthExecutedRows.length <= 0) return null;
    if (monthExecutedRenderedCount > 0) return null;
    const sample = monthExecutedRows.slice(0, 5).map((w) => ({
      id: w.id,
      date: normalizeDateKey(w.date),
      dayKey: normalizeDateKey(workoutDayKey(w)),
      duration: w.durationMinutes,
      tss: w.tss,
    }));
    return {
      totalRows: monthExecutedRows.length,
      sample,
    };
  }, [monthExecutedRows, monthExecutedRenderedCount]);

  const dayPlanned = plannedByDate.get(selectedDate) ?? [];
  const dayExecuted = executedByDate.get(selectedDate) ?? [];
  const builderReplacePlanned = useMemo(
    () => dayPlanned.find((w) => !isViryaPlannedWorkout(w.notes ?? null)) ?? dayPlanned[0] ?? null,
    [dayPlanned],
  );

  const calendarLibraryContract = useMemo(() => {
    const first = dayPlanned[0];
    if (!first) return null;
    return parsePro2BuilderSessionFromNotes(first.notes ?? null);
  }, [dayPlanned]);

  const monthLabel = monthCursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  async function handleFileImportSubmit(e: FormEvent) {
    e.preventDefault();
    if (!athleteId || !fileImportForm.file) return;
    if (trainingImportInFlightRef.current) return;
    trainingImportInFlightRef.current = true;
    setSaving(true);
    setErr(null);
    setSuccess(null);
    try {
      let refreshAnchor: string | null = null;

      if (fileImportForm.mode === "planned") {
        const json = await importPlannedProgramFile({
          athleteId,
          file: fileImportForm.file,
          notes: fileImportForm.notes || undefined,
          date: normalizeDateKey(fileImportForm.date) || selectedDate,
        });
        if (json.structured) {
          const sf = typeof json.structuredFormat === "string" ? json.structuredFormat : "strutturato";
          const sc = json.structuredCompanion as
            | { status: string; message?: string; mode?: string; reason?: string }
            | undefined;
          let companionHint = "";
          if (sc?.status === "ok") {
            companionHint =
              " È stata creata anche una traccia EXEC companion (durata/TSS coerenti con la seduta) per l’Analyzer.";
          } else if (sc?.status === "error" && typeof sc.message === "string" && sc.message.trim()) {
            companionHint = ` Nota traccia companion: ${sc.message.trim()}`;
          } else if (sc?.status === "skipped" && typeof sc.reason === "string" && sc.reason.trim()) {
            companionHint = ` Traccia companion non creata: ${sc.reason.trim()}`;
          }
          const nRows =
            Array.isArray(json.intervalLadder) && json.intervalLadder.length > 0
              ? json.intervalLadder.length
              : null;
          const ladderHint =
            nRows != null
              ? ` Scala intervalli: ${nRows} righe (durata + watt per blocco); nella risposta JSON trovi anche "intervalLadderCsv" (formato CSV per Excel).`
              : "";
          setSuccess(
            `Seduta pianificata importata (${sf}). In notes è stato salvato il contratto Builder (BUILDER_SESSION_JSON) per il grafico a blocchi; apri la seduta su quel giorno per rivederla.${ladderHint}${companionHint}`,
          );
        } else {
          const n = typeof json.importedCount === "number" ? json.importedCount : 0;
          setSuccess(
            `Programmazione importata: ${n} sedute. Compaiono come chip PLAN (tipo, durata, TSS). Per curve ZWO/ERG/MRC o FIT workout usa un file dedicato: viene creata una seduta con struttura Builder in notes.`,
          );
        }
        const fd = json.firstDate;
        if (fd && /^\d{4}-\d{2}-\d{2}$/.test(fd)) {
          setSelectedDate(fd);
          const d = new Date(`${fd}T12:00:00`);
          setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
        }
        refreshAnchor =
          normalizeDateKey(typeof json.firstDate === "string" ? json.firstDate : "") ||
          normalizeDateKey(fileImportForm.date) ||
          selectedDate ||
          null;
      } else {
        const effectiveDate = normalizeDateKey(fileImportForm.date) || selectedDate;
        const importIntent = fileImportForm.mode === "auto" ? "auto" : "executed";
        const json = await importExecutedWorkoutFile({
          athleteId,
          file: fileImportForm.file,
          date: effectiveDate,
          plannedDate: effectiveDate,
          notes: fileImportForm.notes || undefined,
          device: fileImportForm.device !== "auto" ? fileImportForm.device : undefined,
          importIntent,
        });
        if (json.structured) {
          const sf = typeof json.structuredFormat === "string" ? json.structuredFormat.toUpperCase() : "STRUTTURATO";
          const fallbackNote =
            json.routeReason === "auto_fallback_empty_executed_fit_workout"
              ? " Rilevato programma FIT (non attività): salvato come PLAN con blocchi Builder."
              : "";
          setSuccess(
            `Seduta in calendario (PLAN · ${sf}) per atleta attivo · giorno ${effectiveDate}.${fallbackNote} Apri il giorno per grafico a blocchi e export ZWO/FIT.`,
          );
          const fd = json.firstDate;
          if (fd && /^\d{4}-\d{2}-\d{2}$/.test(fd)) {
            setSelectedDate(fd);
            const d = new Date(`${fd}T12:00:00`);
            setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            refreshAnchor = fd;
          } else {
            refreshAnchor = effectiveDate;
          }
        } else {
          const fmt =
            json.parsed && typeof json.parsed.format === "string"
              ? String(json.parsed.format).toUpperCase()
              : "FILE";
          setSuccess(`Workout eseguito (EXEC · ${fmt}) · giorno ${effectiveDate}.`);
          const imp = json.imported as { date?: string } | null | undefined;
          const impDate =
            (imp && typeof imp.date === "string" ? imp.date : null) ??
            (json.parsed && typeof json.parsed.date === "string" ? json.parsed.date : null);
          if (impDate && /^\d{4}-\d{2}-\d{2}$/.test(impDate.slice(0, 10))) {
            const key = impDate.slice(0, 10);
            setSelectedDate(key);
            const d = new Date(`${key}T12:00:00`);
            setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
          }
          const fromImpDate =
            impDate && /^\d{4}-\d{2}-\d{2}$/.test(impDate.slice(0, 10)) ? impDate.slice(0, 10) : null;
          const fromParsedDate = normalizeDateKey(
            json.parsed && typeof json.parsed.date === "string" ? json.parsed.date : "",
          );
          refreshAnchor = fromImpDate ?? (fromParsedDate || effectiveDate || null);
        }
      }
      setFileImportForm((f) => ({ ...f, file: null }));

      const anchorKey = (refreshAnchor ?? "").trim().slice(0, 10);
      await loadMonth(/^\d{4}-\d{2}-\d{2}$/.test(anchorKey) ? { anchorDay: anchorKey } : undefined);
      /** Forza rifetch del dettaglio giorno con trace pieno anche se selectedDate
       *  e' uguale a anchorKey: senza tick l'useEffect non parte. */
      setSelectedDayRefreshTick((t) => t + 1);
    } catch (x) {
      const msg = x instanceof Error ? x.message : "Errore in fase di import.";
      if (
        fileImportForm.mode === "planned" &&
        fileImportForm.fallbackExecutedOnPlannedError &&
        fileImportForm.file
      ) {
        try {
          const effectiveExecutedDate = normalizeDateKey(fileImportForm.date) || selectedDate;
          await importExecutedWorkoutFile({
            athleteId,
            file: fileImportForm.file,
            date: effectiveExecutedDate,
            notes: fileImportForm.notes || undefined,
            device: fileImportForm.device !== "auto" ? fileImportForm.device : undefined,
            importIntent: "executed",
          });
          setErr(null);
          setSuccess(
            `Import programmato non riuscito (${msg}). Stesso file salvato come workout eseguito nel giorno scelto: apri la sezione Analyzer sotto per le serie (come da import eseguito).`,
          );
          const key = effectiveExecutedDate.slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
            setSelectedDate(key);
            const d = new Date(`${key}T12:00:00`);
            setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
          }
          await loadMonth(/^\d{4}-\d{2}-\d{2}$/.test(key) ? { anchorDay: key } : undefined);
          setSelectedDayRefreshTick((t) => t + 1);
          setFileImportForm((f) => ({ ...f, file: null }));
        } catch (fb) {
          setErr(
            `${msg} — fallback Analyzer (import eseguito): ${fb instanceof Error ? fb.message : "non riuscito"}.`,
          );
        }
      } else {
        setErr(msg);
      }
    } finally {
      trainingImportInFlightRef.current = false;
      setSaving(false);
    }
  }

  return (
    <Pro2ModulePageShell
      eyebrow="Training · Calendar"
      eyebrowClassName="text-sky-400"
      title="Calendar"
      description="Griglia mensile come V1: ogni giorno è una cella ampia con chip PLAN / EXEC e dati minimi (durata, TSS, kcal; da device quando l’API espone le tracce)."
      headerActions={
        <>
          <Pro2Link
            href={`/training/builder?date=${encodeURIComponent(selectedDate)}`}
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Builder · crea seduta
          </Pro2Link>
          <Pro2Link
            href="/training"
            variant="ghost"
            className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:border-cyan-400/50 hover:bg-cyan-500/15"
          >
            Hub
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        {isMobileApp ? null : <TrainingSubnav />}
      </div>

      {readSpineCoverage && athleteId ? (
        <TrainingPlannedWindowContextStrip
          className="mb-4"
          label="Calendario"
          readSpineCoverage={readSpineCoverage}
          twinContextStrip={twinContextStrip}
          athleteId={athleteId}
          plannedProvenanceSummary={plannedProvenanceSummary}
        />
      ) : null}

      {success ? (
        <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">
          {success}
        </p>
      ) : null}

      <div
        className={`mb-6 grid gap-3 ${
          twinContextStrip ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        <div className="rounded-2xl border border-cyan-500/25 bg-black/35 px-4 py-3">
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-cyan-400/90">Mese</p>
          <p className="mt-1 capitalize text-lg font-bold text-white">{monthLabel}</p>
        </div>
        <div className="rounded-2xl border border-fuchsia-500/25 bg-black/35 px-4 py-3">
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-fuchsia-400/90">Sessioni in finestra</p>
          <p className="mt-1 text-lg font-bold text-white">{monthlySessionCount}</p>
        </div>
        <div className="rounded-2xl border border-orange-500/25 bg-black/35 px-4 py-3">
          <p className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-orange-400/90">Giorno attivo</p>
          <p className="mt-1 text-lg font-bold text-white">
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })}
          </p>
        </div>
        {twinContextStrip ? (
          <div className="rounded-2xl border border-violet-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-violet-400/90">Twin · adattamento</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-white">
              {twinContextStrip.adaptationScoreV1 != null
                ? Math.round(twinContextStrip.adaptationScoreV1.compositeScore)
                : twinContextStrip.adaptationScore != null
                  ? Math.round(twinContextStrip.adaptationScore)
                  : "—"}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-slate-400">
              {twinContextStrip.recoveryDataTier
                ? `Dati recupero ${
                    twinContextStrip.recoveryDataTier === "minimal"
                      ? "minimi"
                      : twinContextStrip.recoveryDataTier === "extended"
                        ? "estesi"
                        : "standard"
                  }`
                : "Tier —"}
              {twinContextStrip.adaptationScoreV1
                ? ` · conf ${(twinContextStrip.adaptationScoreV1.confidence * 100).toFixed(0)}%`
                : ""}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/50 text-lg text-white hover:border-cyan-400/45"
            onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
            aria-label="Mese precedente"
          >
            ‹
          </button>
          <span className="min-w-[10rem] text-center text-base font-bold capitalize text-white">{monthLabel}</span>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/50 text-lg text-white hover:border-cyan-400/45"
            onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
            aria-label="Mese successivo"
          >
            ›
          </button>
          <button
            type="button"
            className="ml-1 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/15"
            onClick={() => {
              const t = new Date();
              const cur = toDateKey(t);
              setMonthCursor(new Date(t.getFullYear(), t.getMonth(), 1));
              setSelectedDate(cur);
            }}
          >
            Oggi
          </button>
          <Pro2Link
            href={`/training/builder?date=${encodeURIComponent(selectedDate)}`}
            variant="secondary"
            className="ml-2 inline-flex rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-500/15"
          >
            Builder · giorno
          </Pro2Link>
          <button
            type="button"
            className="ml-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/15"
            onClick={() => {
              setShowFileImport((open) => {
                const next = !open;
                if (next) {
                  setFileImportForm((f) => ({ ...f, date: selectedDate }));
                  window.setTimeout(() => {
                    document.getElementById("training-calendar-file-import")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 80);
                }
                return next;
              });
            }}
          >
            {showFileImport ? "Chiudi import" : "Importa file"}
          </button>
        </div>
        <p className="max-w-md text-xs text-slate-500" title={`API: ${fetchFrom} → ${fetchTo}`}>
          I dati caricati includono alcuni giorni prima e dopo il mese visibile, così le sedute ai bordi non spariscono dalla griglia.
        </p>
      </div>

      {ctxLoading || (loading && !calendarReady) ? (
        <div className="mb-8 space-y-2">
          <div className="h-3 w-full max-w-2xl animate-pulse rounded-lg bg-cyan-500/10" />
          <div className="h-[280px] w-full animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : null}

      {monthRefreshing ? (
        <p className="mb-3 text-xs text-cyan-300/90" role="status">
          Aggiornamento calendario…
        </p>
      ) : null}

      {viryaReappearWarning ? (
        <p className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100" role="alert">
          {viryaReappearWarning}
        </p>
      ) : null}

      {(fetchDiag?.executedHiddenByPreference ?? 0) > 0 ? (
        <p className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="status">
          {fetchDiag!.executedHiddenByPreference}{" "}
          {fetchDiag!.executedHiddenByPreference === 1 ? "attività eseguita nascosta" : "attività eseguite nascoste"} dal
          calendario in base alle preferenze sorgente dati.{" "}
          <Pro2Link href="/settings" className="text-amber-50 underline underline-offset-2">
            Apri Impostazioni
          </Pro2Link>{" "}
          per includere altri provider (Garmin, Strava, …).
        </p>
      ) : null}

      {err ? (
        <p className="mb-6 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {athleteId && fetchDiag ? (
        <p className="mb-4 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[0.65rem] leading-relaxed text-slate-400">
          <span className="text-slate-500">diag calendario · </span>
          athleteId={athleteId} · HTTP {fetchDiag.status} · planned={fetchDiag.plannedN} · executed={fetchDiag.executedN}
          {fetchDiag.executedFallback ? <span className="text-amber-300"> · executedAdminFallbackUsed=true</span> : null}
          {(fetchDiag.executedHiddenByPreference ?? 0) > 0 ? (
            <span className="text-amber-300"> · hiddenBySourcePref={fetchDiag.executedHiddenByPreference}</span>
          ) : null}
          {fetchDiag.resFrom && fetchDiag.resTo ? (
            <>
              {" "}
              · API <span className="text-slate-300">{fetchDiag.resFrom}</span> →{" "}
              <span className="text-slate-300">{fetchDiag.resTo}</span>
            </>
          ) : null}
          {fetchDiag.sampleDates?.length ? (
            <span>
              {" "}
              · dates=[<span className="text-slate-300">{fetchDiag.sampleDates.join(", ")}</span>]
            </span>
          ) : null}
          {fetchDiag.apiError ? <span className="text-amber-400/90"> · {fetchDiag.apiError}</span> : null}
        </p>
      ) : null}

      {dayExecuted.some(
        (w) =>
          (w.durationMinutes ?? 0) <= 0 &&
          typeof w.source === "string" &&
          w.source.startsWith("file_import"),
      ) ? (
        <p className="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100" role="status">
          Import FIT su questo giorno salvato come EXEC senza durata (import precedente in modalità «Attività»). Re-importa lo
          stesso file con modalità <strong className="text-amber-50">Auto</strong> (o «Workout pianificato»): crea la riga PLAN
          con grafico a blocchi, durata, TSS e kJ come nel Builder; la riga EXEC vuota viene rimossa in automatico.
        </p>
      ) : null}

      {executedCalendarGap ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <p className="font-mono text-[0.65rem] uppercase tracking-wide text-amber-300">
            warning · executed presenti ma non renderizzati in griglia
          </p>
          <p className="mt-1 text-amber-100/90">
            Eseguiti nel mese: {executedCalendarGap.totalRows}. Chip EXEC visibili: {monthExecutedRenderedCount}.
          </p>
          <pre className="mt-2 overflow-x-auto rounded border border-amber-500/25 bg-black/40 p-2 font-mono text-[0.65rem] leading-relaxed text-amber-200/95">
            {JSON.stringify(executedCalendarGap.sample, null, 2)}
          </pre>
        </div>
      ) : null}

      {!ctxLoading && calendarReady && !err ? (
        <Fragment>
          <TrainingViryaActivePlanStrip
            athleteId={athleteId}
            selectedDate={selectedDate}
            plans={viryaPlans}
            loadErr={viryaPlansLoadErr}
            plansLoading={viryaPlansLoading}
          />
          <section className="tc2-calendar-shell mb-10 rounded-2xl border border-violet-500/20 bg-gradient-to-b from-slate-950/80 to-black/50 shadow-inner shadow-violet-950/25">
            <p className="border-b border-white/10 px-4 py-3 text-xs leading-relaxed text-slate-400">
              Trascina una chip <strong className="text-violet-200">PLAN</strong> su un altro giorno per spostare la seduta
              (stessa struttura Builder, nuova data). I workout eseguiti (EXEC) non si spostano.
            </p>
            <div className="tc2-calendar-scroll">
              <div className="tc2-calendar-frame">
                <div className="tc2-calendar-weekdays">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="tc2-calendar-weekday-label">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="tc2-calendar-grid">
                  {Array.from({ length: monthStartWeekdayMonday }).map((_, i) => (
                    <div key={`pad-start-${i}`} className="tc2-calendar-grid-pad" aria-hidden />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const pList = plannedByDate.get(date) ?? [];
                    const eList = executedByDate.get(date) ?? [];
                    const active = selectedDate === date;
                    const hasExecuted = eList.length > 0;
                    const wellness = wellnessByDate[date];
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => {
                          setSelectedDate(date);
                          const target =
                            pList.length > 0
                              ? "calendar-day-planned-detail"
                              : "calendar-day-builder-actions";
                          window.setTimeout(() => {
                            document.getElementById(target)?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          }, 60);
                        }}
                        onDragOver={(e) => {
                          if (!readPlannedDragPayload(e.dataTransfer)) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDropTargetDate(date);
                        }}
                        onDragLeave={() => {
                          setDropTargetDate((prev) => (prev === date ? null : prev));
                        }}
                        onDrop={(e) => {
                          const payload = readPlannedDragPayload(e.dataTransfer);
                          if (!payload) return;
                          e.preventDefault();
                          e.stopPropagation();
                          void movePlannedWorkoutToDate(payload.id, payload.fromDate, date);
                        }}
                        className={`tc2-calendar-day ${active ? "tc2-calendar-day--active" : ""} ${
                          dropTargetDate === date ? "tc2-calendar-day--drop-target" : ""
                        }`}
                      >
                        <div className="tc2-calendar-day-num flex items-center justify-between gap-1">
                          <span>{day}</span>
                          {hasExecuted ? (
                            <span
                              className="tc2-calendar-exec-dot"
                              title={`${eList.length} eseguit${eList.length === 1 ? "o" : "i"}`}
                              aria-hidden
                            />
                          ) : null}
                        </div>
                        {pList.length > 0 ? (
                          <div
                            className="tc2-calendar-day-glyphs flex flex-wrap items-center justify-center gap-0.5 py-0.5"
                            aria-label="Sport pianificati"
                          >
                            {uniquePlannedSportGlyphs(pList, 5).map((glyph) => (
                              <SportDisciplineGlyph key={glyph} glyph={glyph} className="h-4 w-4 text-violet-200/95" />
                            ))}
                          </div>
                        ) : null}
                        {wellness ? (
                          <div className="tc2-calendar-wellness">
                            {wellness.sleepHours != null ? (
                              <span className="text-emerald-200/90">
                                Z {Math.floor(wellness.sleepHours)}h
                                {String(Math.round((wellness.sleepHours - Math.floor(wellness.sleepHours)) * 60)).padStart(2, "0")}
                              </span>
                            ) : null}
                            {wellness.hrvMs != null ? (
                              <span className="text-violet-200/90">HRV {Math.round(wellness.hrvMs)}</span>
                            ) : null}
                            {wellness.restingHrBpm != null ? (
                              <span className="text-fuchsia-200/90">RHR {Math.round(wellness.restingHrBpm)}</span>
                            ) : null}
                          </div>
                        ) : null}
                        {pList.slice(0, 2).map((w) => {
                          const chip = plannedCalendarChipViewModel(w, { athleteFtpWatts });
                          const moving = movePlannedBusyId === w.id;
                          return (
                            <div
                              key={w.id}
                              draggable={!moving && Boolean(athleteId)}
                              onDragStart={(e) => {
                                if (!athleteId || moving) {
                                  e.preventDefault();
                                  return;
                                }
                                e.stopPropagation();
                                const payload: PlannedDragPayload = {
                                  id: w.id,
                                  fromDate: normalizeDateKey(w.date) || date,
                                };
                                e.dataTransfer.setData(PLANNED_DRAG_MIME, JSON.stringify(payload));
                                e.dataTransfer.effectAllowed = "move";
                                setDragPlannedId(w.id);
                              }}
                              onDragEnd={() => {
                                setDragPlannedId(null);
                                setDropTargetDate(null);
                              }}
                              className={`tc2-calendar-chip tc2-calendar-chip--draggable ${chip.chipClass} ${
                                dragPlannedId === w.id ? "tc2-calendar-chip--dragging" : ""
                              } ${moving ? "opacity-50" : ""}`}
                              title="Trascina su un altro giorno del calendario"
                            >
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className={`tc2-calendar-chip-icon tc2-calendar-chip-icon--${chip.family}`}>
                                  {chip.glyph ? (
                                    <SportDisciplineGlyph glyph={chip.glyph} className="h-4 w-4" />
                                  ) : (
                                    <SportGlyph type={w.type} />
                                  )}
                                </span>
                                <span>PLAN</span>
                                <span
                                  className={`tc2-calendar-chip-sport-badge ${
                                    chip.family === "strength"
                                      ? "bg-fuchsia-500/30 text-fuchsia-100"
                                      : chip.family === "aerobic"
                                        ? "bg-cyan-500/25 text-cyan-100"
                                        : "bg-white/10 text-gray-200"
                                  }`}
                                >
                                  {chip.sportLabel}
                                </span>
                              </div>
                              <div>
                                {chip.minutes}m · {LOAD_CHIP_LABEL} {chip.load}
                              </div>
                              <div className="opacity-90">{chip.detailLine}</div>
                            </div>
                          );
                        })}
                        {pList.length > 2 ? (
                          <div className="text-[10px] font-semibold text-violet-200/90">+{pList.length - 2} pianif.</div>
                        ) : null}
                        {eList.slice(0, 2).map((w) => {
                          const tr = traceRecord(w);
                          const km = pickMetric(tr, ["distance_km", "distanceKm", "km"]);
                          const pwr = pickMetric(tr, ["power_avg_w", "power_avg", "avg_power", "powerAvg", "avgPower"]);
                          const importedFile = pickText(tr, ["imported_file_name"]);
                          return (
                            <div key={w.id} className="tc2-calendar-chip tc2-calendar-chip-exec">
                              <div className="font-bold">✅ EXEC</div>
                              <div>
                                {w.durationMinutes}m · {LOAD_CHIP_LABEL}{" "}
                                {resolveExecutedTrainingLoad({
                                  storedTss: w.tss,
                                  durationMinutes: w.durationMinutes,
                                  traceSummary: tr,
                                }).toFixed(0)}
                              </div>
                              <div>
                                km {km != null ? km.toFixed(1) : "—"} · Pavg {pwr != null ? Math.round(pwr) : "—"} · kcal{" "}
                                {w.kcal != null ? Number(w.kcal).toFixed(0) : "—"}
                              </div>
                              {importedFile ? (
                                <div className="mt-0.5 opacity-90">
                                  file: {importedFile.slice(0, 40)}
                                  {importedFile.length > 40 ? "…" : ""}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        {eList.length > 2 ? (
                          <div className="text-[10px] font-semibold text-sky-200/90">+{eList.length - 2} eseguiti</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div id="calendar-day-builder-actions" className="mb-8 scroll-mt-24 w-full min-w-0">
            <Pro2SectionCard
              accent="fuchsia"
              title={dayPlanned.length > 0 ? "Builder · giornata" : "Genera seduta con Builder"}
              subtitle={`${selectedDate} · crea o adatta il piano coach su questo giorno`}
              icon={LayoutGrid}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Pro2Link
                  href={`/training/builder?date=${encodeURIComponent(selectedDate)}`}
                  variant="primary"
                  className="justify-center border border-fuchsia-400/40 bg-gradient-to-r from-fuchsia-600/80 via-violet-600/80 to-orange-500/80 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:brightness-110"
                >
                  {dayPlanned.length > 0 ? "Apri Builder · aggiungi / adatta" : "Genera piano con Builder"}
                </Pro2Link>
                {builderReplacePlanned ? (
                  <Pro2Link
                    href={`/training/builder?date=${encodeURIComponent(selectedDate)}&replace_planned_id=${encodeURIComponent(builderReplacePlanned.id)}`}
                    variant="secondary"
                    className="justify-center border border-orange-400/35 bg-orange-500/10 text-orange-100"
                  >
                    Sostituisci seduta esistente
                  </Pro2Link>
                ) : null}
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-400 hover:border-violet-400/30 hover:text-violet-200"
                  onClick={() => {
                    setShowFileImport(true);
                    setFileImportForm((f) => ({ ...f, date: selectedDate }));
                    window.setTimeout(() => {
                      document.getElementById("training-calendar-file-import")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 80);
                  }}
                >
                  Oppure importa file esterno
                </button>
              </div>
              {dayPlanned.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">
                  Nessuna seduta pianificata: il Builder è il percorso canonico Pro 2 (motore deterministico + salvataggio su{" "}
                  <code className="text-fuchsia-200/90">planned_workouts</code>).
                </p>
              ) : null}
            </Pro2SectionCard>
          </div>

          {dayPlanned.length > 0 ? (
            <div id="calendar-day-planned-detail" className="mb-8 scroll-mt-24 w-full min-w-0">
              <Pro2SectionCard
                accent="fuchsia"
                title="Sedute pianificate"
                subtitle={`${selectedDate} · ${dayPlanned.length} in giornata — scheda gym / struttura builder`}
                icon={CalendarDays}
              >
                {dayPlanned.length >= 2 && athleteId ? (
                  <div className="mb-4 rounded-xl border border-amber-400/35 bg-amber-950/30 px-3 py-3">
                    <p className="text-xs leading-relaxed text-amber-100/95">
                      Su questo giorno ci sono <strong>{dayPlanned.length}</strong> righe distinte in{" "}
                      <code className="rounded bg-black/40 px-1">planned_workouts</code>. Elimina una sola seduta
                      lascia le altre visibili (non è un ripristino automatico).
                    </p>
                    {dayDeleteAllConfirm ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={dayDeleteAllBusy}
                          className="rounded-lg border border-rose-300/50 bg-rose-500/25 px-2 py-1 text-xs font-bold text-white hover:bg-rose-500/40 disabled:opacity-40"
                          onClick={async () => {
                            setDayDeleteAllBusy(true);
                            setSuccess(null);
                            setErr(null);
                            try {
                              const r = await deletePlannedWorkoutsOnDate({
                                athleteId,
                                date: selectedDate,
                              });
                              for (const w of dayPlanned) {
                                locallyRemovedPlannedIdsRef.current.add(w.id);
                              }
                              setPlanned((prev) =>
                                prev.filter((x) => normalizeDateKey(x.date) !== selectedDate),
                              );
                              setDayDeleteAllConfirm(false);
                              setSuccess(
                                `Rimosse ${r.deletedOnDateCount} sedute pianificate del ${selectedDate}.`,
                              );
                              await loadMonth();
                            } catch (e) {
                              setErr(e instanceof Error ? e.message : "Eliminazione giorno non riuscita");
                            } finally {
                              setDayDeleteAllBusy(false);
                            }
                          }}
                        >
                          {dayDeleteAllBusy ? "Elimino…" : `Conferma: elimina tutte (${dayPlanned.length})`}
                        </button>
                        <button
                          type="button"
                          disabled={dayDeleteAllBusy}
                          className="rounded-lg border border-white/15 px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
                          onClick={() => setDayDeleteAllConfirm(false)}
                        >
                          Annulla
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-2 rounded-lg border border-rose-400/45 bg-rose-500/15 px-2.5 py-1.5 text-xs font-bold text-rose-100 hover:bg-rose-500/25"
                        onClick={() => setDayDeleteAllConfirm(true)}
                      >
                        Elimina tutte le sedute di questo giorno
                      </button>
                    )}
                  </div>
                ) : null}
                <ul className="space-y-5">
                  {dayPlanned.map((w) => (
                    <li key={w.id}>
                      <div
                        draggable={movePlannedBusyId !== w.id && Boolean(athleteId)}
                        onDragStart={(e) => {
                          if (!athleteId || movePlannedBusyId === w.id) {
                            e.preventDefault();
                            return;
                          }
                          const payload: PlannedDragPayload = {
                            id: w.id,
                            fromDate: normalizeDateKey(w.date) || selectedDate,
                          };
                          e.dataTransfer.setData(PLANNED_DRAG_MIME, JSON.stringify(payload));
                          e.dataTransfer.effectAllowed = "move";
                          setDragPlannedId(w.id);
                        }}
                        onDragEnd={() => {
                          setDragPlannedId(null);
                          setDropTargetDate(null);
                        }}
                        className={`mb-2 flex cursor-grab items-center gap-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-100 active:cursor-grabbing ${
                          dragPlannedId === w.id ? "ring-1 ring-violet-400/60" : ""
                        }`}
                        title="Trascina su un giorno del calendario sopra"
                      >
                        <span aria-hidden className="text-violet-300/80">
                          ⋮⋮
                        </span>
                        <span>
                          Trascina su un altro giorno ·{" "}
                          {plannedCalendarChipViewModel(w, { athleteFtpWatts }).sportLabel}
                        </span>
                      </div>
                      <CalendarPlannedBuilderDetail
                        workout={w}
                        athleteId={athleteId}
                        athleteFtpWatts={athleteFtpWatts}
                        onDeleted={async (removedId) => {
                          if (removedId) {
                            locallyRemovedPlannedIdsRef.current.add(removedId);
                            setPlanned((prev) => prev.filter((x) => x.id !== removedId));
                          }
                          await loadMonth();
                        }}
                        onCalendarMutated={async () => {
                          if (athleteId) invalidatePlannedWindowCacheForAthlete(athleteId);
                          await loadMonth({ anchorDay: selectedDate });
                          setSelectedDayRefreshTick((t) => t + 1);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </Pro2SectionCard>
            </div>
          ) : null}

          <div className="mb-8 w-full min-w-0">
            <CoachWorkoutLibraryPanel
              athleteId={athleteId}
              targetDate={selectedDate}
              contractToSave={calendarLibraryContract}
              saveTitle={calendarLibraryContract?.sessionName ?? undefined}
              sourcePlannedId={dayPlanned[0]?.id ?? null}
              onApplied={() => void loadMonth()}
            />
          </div>

          <div className="mb-8 w-full min-w-0">
            <TrainingPeriodVolumeSummary athleteId={athleteId} deferUntilVisible />
          </div>

          {belowFoldReady ? (
          <>
          <div className="mb-8 w-full min-w-0">
            <CalendarDaySessionDetail
              selectedDate={selectedDate}
              dayExecuted={dayExecuted}
              athleteId={athleteId}
            />
          </div>

          <div className="mb-8 w-full min-w-0">
            <CalendarDayWellnessDetail athleteId={athleteId} selectedDate={selectedDate} />
          </div>

          <div className="mb-10 w-full min-w-0">
            <TrainingCalendarAnalyzer
              selectedDate={selectedDate}
              dayPlanned={dayPlanned}
              dayExecuted={dayExecuted}
              monthExecuted={executed}
              athleteId={athleteId}
              onExecutedChanged={() => void loadMonth()}
              onPlannedChanged={(removedId) => {
                if (removedId) {
                  locallyRemovedPlannedIdsRef.current.add(removedId);
                  setPlanned((prev) => prev.filter((w) => w.id !== removedId));
                }
                void loadMonth();
              }}
            />
          </div>
          </>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)]">
            <div className="space-y-6">
              {showFileImport ? (
                <div id="training-calendar-file-import" className="scroll-mt-24">
                <Pro2SectionCard
                  accent="violet"
                  title="Import da file"
                  subtitle="Auto: FIT workout → calendario (PLAN); attività → EXEC. Calendario: ZWO/ERG/MRC/CSV. Eseguito: traccia registrata."
                  icon={FileUp}
                >
                  <form onSubmit={handleFileImportSubmit} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Modalità
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                      value={fileImportForm.mode}
                      onChange={(e) => {
                        const mode = e.target.value as "auto" | "executed" | "planned";
                        setFileImportForm((f) => ({
                          ...f,
                          mode,
                          date: normalizeDateKey(f.date) || selectedDate,
                          fallbackExecutedOnPlannedError: mode === "planned" ? f.fallbackExecutedOnPlannedError : false,
                        }));
                      }}
                    >
                      <option value="auto">Auto (consigliato)</option>
                      <option value="planned">Calendario · export device (PLAN)</option>
                      <option value="executed">Attività registrata (EXEC)</option>
                    </select>
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Device source
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                      value={fileImportForm.device}
                      onChange={(e) => setFileImportForm((f) => ({ ...f, device: e.target.value }))}
                      disabled={fileImportForm.mode === "planned"}
                    >
                      <option value="auto">Auto (da nome file)</option>
                      <option value="garmin">Garmin</option>
                      <option value="wahoo">Wahoo (ELEMNT / RIVAL)</option>
                      <option value="suunto">Suunto</option>
                      <option value="polar">Polar</option>
                      <option value="coros">COROS</option>
                      <option value="hammerhead">Hammerhead Karoo</option>
                      <option value="apple_watch">Apple Watch / Health</option>
                      <option value="zwift">Zwift</option>
                      <option value="strava">Strava</option>
                      <option value="trainingpeaks">TrainingPeaks</option>
                      <option value="whoop">WHOOP</option>
                      <option value="oura">Oura</option>
                      <option value="other">Altro</option>
                    </select>
                  </label>
                </div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  File
                  <input
                    type="file"
                    className="mt-1 w-full rounded-xl border border-dashed border-white/20 bg-black/40 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-3 file:py-1"
                    accept=".csv,.json,.tcx,.gpx,.zwo,.erg,.mrc,.fit,.fit.gz,.gz"
                    onChange={(e) => setFileImportForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Giorno nel calendario
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                    value={fileImportForm.date}
                    onChange={(e) => setFileImportForm((f) => ({ ...f, date: e.target.value }))}
                  />
                  <span className="mt-1 block font-normal normal-case text-slate-500">
                    {fileImportForm.mode === "auto"
                      ? "Auto: FIT/ZWO/ERG/MRC workout → chip PLAN (export Zwift/Rouvy); FIT/TCX/GPX attività → EXEC. Giorno = cella selezionata."
                      : fileImportForm.mode === "executed"
                        ? "Solo tracce registrate (Analyzer). Il giorno è quello selezionato in griglia."
                        : "Programma tabellare o seduta strutturata su questo giorno (PLAN)."}
                  </span>
                </label>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Note import (opzionale)
                  <input
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                    value={fileImportForm.notes}
                    onChange={(e) => setFileImportForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </label>
                <p className="text-xs text-slate-500">
                  {fileImportForm.mode === "planned"
                    ? "Tabellare: CSV/JSON export calendario (più sedute). Strutturato: ZWO, ERG, MRC o FIT workout — una seduta nel giorno scelto, con `BUILDER_SESSION_JSON` in notes (stesso formato del Builder) per il grafico a blocchi."
                    : "Eseguito: FIT/FIT.GZ, CSV, JSON, TCX, GPX. Il salvataggio usa il giorno indicato sopra (cella corrente se non modifichi la data). Device: auto o manuale."}
                </p>
                {fileImportForm.mode === "planned" ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0"
                      checked={fileImportForm.fallbackExecutedOnPlannedError}
                      onChange={(e) =>
                        setFileImportForm((f) => ({ ...f, fallbackExecutedOnPlannedError: e.target.checked }))
                      }
                    />
                    <span>
                      Se l&apos;import programmato fallisce, importa lo stesso file come workout eseguito (traccia per
                      Analyzer). Utile se il FIT non si converte bene in Builder: l&apos;Analyzer usa le serie come per
                      gli eseguiti (i FIT solo-workout senza record possono avere grafici minimi).
                    </span>
                  </label>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={saving || !athleteId || !fileImportForm.file}
                    className="rounded-xl border border-violet-400/50 bg-violet-500/20 px-4 py-2 text-sm font-bold text-violet-100 hover:bg-violet-500/30 disabled:opacity-40"
                  >
                    {saving ? "Import…" : fileImportForm.mode === "planned" ? "Importa programma" : "Importa allenamento"}
                  </button>
                  <Pro2Link
                    href={selectedSessionHref}
                    variant="ghost"
                    className="border border-cyan-500/35 bg-cyan-500/10 text-cyan-100"
                  >
                    <LineChart className="mr-1 inline h-4 w-4" aria-hidden />
                    Giornata
                  </Pro2Link>
                </div>
                  </form>
                </Pro2SectionCard>
                </div>
              ) : null}

              {!showFileImport ? (
                <button
                  type="button"
                  className="group w-full rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/25 via-black/50 to-black/70 p-5 text-left shadow-inner transition hover:border-cyan-400/45 hover:bg-cyan-950/30"
                  onClick={() => {
                    setFileImportForm((f) => ({ ...f, date: selectedDate }));
                    setShowFileImport(true);
                    window.setTimeout(() => {
                      document.getElementById("training-calendar-file-import")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 80);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-cyan-400/45 bg-cyan-500/35 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.3)]">
                      <FileUp className="h-5 w-5" strokeWidth={2.35} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold text-white group-hover:text-cyan-50">Import veloce</h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Apre il pannello <strong className="text-slate-200">Import da file</strong> qui sotto e scorre al form (stesso flusso del pulsante &quot;Importa file&quot; in alto).
                      </p>
                    </div>
                  </div>
                </button>
              ) : null}
            </div>

            <aside className="space-y-6">
              <Pro2SectionCard
                accent="orange"
                title="Giorno selezionato"
                subtitle={new Date(`${selectedDate}T12:00:00`).toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                icon={Sparkles}
              >
                <p className="font-mono text-xs text-gray-500">{selectedDate}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Pro2Link
                    href={`/training/builder?date=${encodeURIComponent(selectedDate)}`}
                    variant="primary"
                    className="border border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-50"
                  >
                    <LayoutGrid className="mr-1 inline h-4 w-4" aria-hidden />
                    Genera con Builder
                  </Pro2Link>
                  <Pro2Link
                    href={`/physiology/daily/${encodeURIComponent(selectedDate)}`}
                    variant="ghost"
                    className="border border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
                  >
                    <Heart className="mr-1 inline h-4 w-4" aria-hidden />
                    Fisiologia · giornata
                  </Pro2Link>
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">Pianificato</p>
                  {dayPlanned.length === 0 ? (
                    <p className="text-sm text-gray-500">Nessuna seduta pianificata.</p>
                  ) : (
                    <>
                      <p className="text-sm text-fuchsia-200/85">
                        {dayPlanned.length} seduta{dayPlanned.length === 1 ? "" : "e"} — scheda e dettaglio sopra la griglia.
                      </p>
                      <button
                        type="button"
                        className="text-xs font-semibold text-cyan-300/90 underline-offset-2 hover:underline"
                        onClick={() =>
                          document.getElementById("calendar-day-planned-detail")?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          })
                        }
                      >
                        Vai alle sedute pianificate ↑
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-6 space-y-3 border-t border-white/10 pt-6">
                  <p className="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">
                    <Activity className="h-3.5 w-3.5" aria-hidden />
                    Eseguito
                  </p>
                  {dayExecuted.length === 0 ? (
                    <p className="text-sm text-gray-500">Nessun eseguito in questo giorno.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {dayExecuted.map((w) => (
                        <li
                          key={w.id}
                          className="rounded-xl border border-sky-500/30 bg-sky-500/[0.08] px-3 py-2 text-sm text-gray-200"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>{formatExecutedWorkoutSummary(w)}</span>
                            <Pro2Link
                              href={selectedSessionHref}
                              variant="ghost"
                              className="shrink-0 border border-sky-500/35 px-2 py-1 text-xs"
                            >
                              Apri
                            </Pro2Link>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Pro2SectionCard>
            </aside>
          </div>
        </Fragment>
      ) : null}
    </Pro2ModulePageShell>
  );
}
