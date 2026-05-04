"use client";

import type { ExecutedWorkout, PlannedWorkout } from "@empathy/domain-training";
import { formatExecutedWorkoutSummary } from "@empathy/domain-training";
import { Activity, CalendarDays, FileUp, Heart, LineChart, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlannedBuilderDetail } from "@/components/training/CalendarPlannedBuilderDetail";
import { TrainingCalendarAnalyzer } from "@/components/training/TrainingCalendarAnalyzer";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import {
  effectiveDurationMinutesFromPro2Contract,
  effectiveTssDisplayFromPro2Contract,
  parsePro2BuilderSessionFromNotes,
} from "@/lib/training/builder/pro2-session-notes";
import { normalizeDateKey, traceRecord, workoutDayKey } from "@/lib/training/calendar-analyzer-helpers";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import type { TrainingPlannedWindowOkViewModel, TrainingTwinContextStripViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import { importExecutedWorkoutFile, importPlannedProgramFile } from "@/modules/training/services/training-import-api";

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
  const fetchFrom = addDaysToIsoDateKey(monthFrom, -45);
  const fetchTo = addDaysToIsoDateKey(monthTo, 45);
  return { monthFrom, monthTo, fetchFrom, fetchTo };
}

function plannedChipMetrics(w: PlannedWorkout): { minutes: number; tss: number } {
  const c = parsePro2BuilderSessionFromNotes(w.notes ?? null);
  return {
    minutes: effectiveDurationMinutesFromPro2Contract(c, w.durationMinutes),
    tss: effectiveTssDisplayFromPro2Contract(c, w.tssTarget),
  };
}

function normalizeIsoDateParam(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

const WEEKDAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;

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

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));

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
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [planned, setPlanned] = useState<PlannedWorkout[]>([]);
  const [executed, setExecuted] = useState<ExecutedWorkout[]>([]);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [twinContextStrip, setTwinContextStrip] = useState<TrainingTwinContextStripViewModel | null>(null);
  const [plannedProvenanceSummary, setPlannedProvenanceSummary] = useState<Partial<Record<string, number>> | null>(null);
  const [showFileImport, setShowFileImport] = useState(false);
  const [fileImportForm, setFileImportForm] = useState({
    mode: "executed" as "executed" | "planned",
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
  /** Evita doppio POST import (doppio click / StrictMode) che crea righe PLAN duplicate. */
  const trainingImportInFlightRef = useRef(false);

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
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      let from = fetchFrom;
      let to = fetchTo;
      const anchorRaw = opts?.anchorDay?.trim() ?? "";
      const anchor = anchorRaw.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
      if (anchor) {
        /** Dopo import la `loadMonth` può girare prima che React aggiorni `monthCursor` → finestra mensile troppo stretta; forziamo inclusione del giorno salvato. */
        const padFrom = addDaysToIsoDateKey(anchor, -60);
        const padTo = addDaysToIsoDateKey(anchor, 60);
        from = minIsoDay(from, padFrom);
        to = maxIsoDay(to, padTo);
      }
      const q = new URLSearchParams({ athleteId, from, to });
      /** Calendario: solo planned/executed; evita `resolveAthleteMemory` su ogni cambio mese (vedi `docs/MODULE_FETCH_AUDIT_PRO2.md`). */
      q.set("includeAthleteContext", "0");
      const res = await fetch(`/api/training/planned-window?${q}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: await buildSupabaseAuthHeaders(),
      });
      const json = (await res.json()) as TrainingPlannedWindowOkViewModel | { ok: false; error?: string };
      if (isStale()) return;

      if (!res.ok || !json.ok) {
        setPlanned([]);
        setExecuted([]);
        setReadSpineCoverage(null);
        setTwinContextStrip(null);
        setPlannedProvenanceSummary(null);
        setFetchDiag({
          status: res.status,
          plannedN: 0,
          executedN: 0,
          apiError: ("error" in json && json.error) || res.statusText,
        });
        setErr(("error" in json && json.error) || "Lettura calendario non riuscita.");
        return;
      }
      const p = json.planned ?? [];
      const ex = json.executed ?? [];
      setPlanned(p);
      setExecuted(ex);
      setReadSpineCoverage(json.readSpineCoverage ?? null);
      setTwinContextStrip(json.twinContextStrip ?? null);
      setPlannedProvenanceSummary(json.plannedProvenanceSummary ?? null);
      setFetchDiag({
        status: res.status,
        plannedN: p.length,
        executedN: ex.length,
        resFrom: json.from,
        resTo: json.to,
      });
    } catch {
      if (isStale()) return;
      setErr("Errore di rete.");
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setPlannedProvenanceSummary(null);
      setFetchDiag({ status: 0, plannedN: 0, executedN: 0, apiError: "network" });
    } finally {
      if (!isStale()) {
        setLoading(false);
      }
    }
  },
  [athleteId, ctxLoading, fetchFrom, fetchTo],
);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

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

  const dayPlanned = plannedByDate.get(selectedDate) ?? [];
  const dayExecuted = executedByDate.get(selectedDate) ?? [];

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
        /** Sempre un giorno canonico: la cella selezionata vince se il campo data è vuoto (evita FIT/TCX su “altro” giorno). */
        const effectiveExecutedDate = normalizeDateKey(fileImportForm.date) || selectedDate;
        const json = await importExecutedWorkoutFile({
          athleteId,
          file: fileImportForm.file,
          date: effectiveExecutedDate,
          notes: fileImportForm.notes || undefined,
          device: fileImportForm.device !== "auto" ? fileImportForm.device : undefined,
        });
        const fmt =
          json.parsed && typeof json.parsed.format === "string"
            ? String(json.parsed.format).toUpperCase()
            : "FILE";
        setSuccess(`Workout importato (${fmt}).`);
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
          impDate && /^\d{4}-\d{2}-\d{2}$/.test(impDate.slice(0, 10))
            ? impDate.slice(0, 10)
            : null;
        const fromParsedDate = normalizeDateKey(
          json.parsed && typeof json.parsed.date === "string" ? json.parsed.date : "",
        );
        refreshAnchor = fromImpDate ?? (fromParsedDate || effectiveExecutedDate || null);
      }
      setFileImportForm((f) => ({ ...f, file: null }));

      const anchorKey = (refreshAnchor ?? "").trim().slice(0, 10);
      await loadMonth(/^\d{4}-\d{2}-\d{2}$/.test(anchorKey) ? { anchorDay: anchorKey } : undefined);
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

  const plannedTitleLine = useCallback((w: PlannedWorkout) => {
    const c = parsePro2BuilderSessionFromNotes(w.notes ?? null);
    const name = c?.sessionName?.trim();
    if (name) return name.length > 42 ? `${name.slice(0, 40)}…` : name;
    return w.type;
  }, []);

  return (
    <Pro2ModulePageShell
      eyebrow="Training · Calendar"
      eyebrowClassName="text-sky-400"
      title="Calendar"
      description="Griglia mensile come V1: ogni giorno è una cella ampia con chip PLAN / EXEC e dati minimi (durata, TSS, kcal; da device quando l’API espone le tracce)."
      headerActions={
        <>
          <Pro2Link
            href="/training/builder"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Builder
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
        <TrainingSubnav />
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

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
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

      {ctxLoading || loading ? (
        <div className="mb-8 space-y-2">
          <div className="h-3 w-full max-w-2xl animate-pulse rounded-lg bg-cyan-500/10" />
          <div className="h-[280px] w-full animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : null}

      {err ? (
        <p className="mb-6 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {process.env.NODE_ENV === "development" && athleteId && fetchDiag ? (
        <p className="mb-4 rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-mono text-[0.65rem] leading-relaxed text-slate-400">
          <span className="text-slate-500">diag calendario · </span>
          athleteId={athleteId} · HTTP {fetchDiag.status} · planned={fetchDiag.plannedN} · executed={fetchDiag.executedN}
          {fetchDiag.resFrom && fetchDiag.resTo ? (
            <>
              {" "}
              · API <span className="text-slate-300">{fetchDiag.resFrom}</span> →{" "}
              <span className="text-slate-300">{fetchDiag.resTo}</span>
            </>
          ) : null}
          {fetchDiag.apiError ? <span className="text-amber-400/90"> · {fetchDiag.apiError}</span> : null}
        </p>
      ) : null}

      {!ctxLoading && !loading && !err ? (
        <Fragment>
          <section className="tc2-calendar-shell mb-10 rounded-2xl border border-violet-500/20 bg-gradient-to-b from-slate-950/80 to-black/50 shadow-inner shadow-violet-950/25">
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
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => setSelectedDate(date)}
                        className={`tc2-calendar-day ${active ? "tc2-calendar-day--active" : ""}`}
                      >
                        <div className="tc2-calendar-day-num">{day}</div>
                        {pList.slice(0, 2).map((w) => {
                          const chip = plannedChipMetrics(w);
                          return (
                            <div key={w.id} className="tc2-calendar-chip tc2-calendar-chip-plan">
                              <div className="flex items-center font-bold">
                                <span className="tc2-sport-glyph">
                                  <SportGlyph type={w.type} />
                                </span>
                                PLAN
                              </div>
                              <div>
                                {chip.minutes}m · TSS {chip.tss}
                              </div>
                              <div>
                                {plannedTitleLine(w)} · km — · Pavg — · kcal{" "}
                                {w.kcalTarget != null ? Number(w.kcalTarget).toFixed(0) : "—"}
                              </div>
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
                                {w.durationMinutes}m · TSS {Number(w.tss).toFixed(0)}
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

          <div className="mb-10 w-full min-w-0">
            <TrainingCalendarAnalyzer
              selectedDate={selectedDate}
              dayPlanned={dayPlanned}
              dayExecuted={dayExecuted}
              monthExecuted={executed}
              athleteId={athleteId}
              onExecutedChanged={() => void loadMonth()}
              onPlannedChanged={(removedId) => {
                if (removedId) setPlanned((prev) => prev.filter((w) => w.id !== removedId));
                void loadMonth();
              }}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)]">
            <div className="space-y-6">
              {showFileImport ? (
                <div id="training-calendar-file-import" className="scroll-mt-24">
                <Pro2SectionCard
                  accent="violet"
                  title="Import da file"
                  subtitle="Eseguito: FIT · TCX · GPX · CSV · JSON — Programmato: CSV/JSON calendario · ZWO · ERG · MRC · FIT workout"
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
                        const mode = e.target.value as "executed" | "planned";
                        setFileImportForm((f) => ({
                          ...f,
                          mode,
                          date: normalizeDateKey(f.date) || selectedDate,
                          fallbackExecutedOnPlannedError: mode === "planned" ? f.fallbackExecutedOnPlannedError : false,
                        }));
                      }}
                    >
                      <option value="executed">Workout eseguito</option>
                      <option value="planned">Programmazione coach (planned)</option>
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
                    accept={
                      fileImportForm.mode === "planned"
                        ? ".csv,.json,.zwo,.erg,.mrc,.fit,.fit.gz,.gz"
                        : ".csv,.json,.tcx,.gpx,.fit,.fit.gz,.gz"
                    }
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
                    {fileImportForm.mode === "executed"
                      ? "Di default è il giorno selezionato sulla griglia. Cambialo solo se il file va registrato su un altro giorno."
                      : "Per ZWO / ERG / MRC / FIT workout la seduta strutturata viene creata in questo giorno. Per CSV o JSON a più righe le date nel file restano quelle di riferimento."}
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
                    href={`/training/session/${selectedDate}`}
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

                <div className="mt-3">
                  <Pro2Link
                    href={`/physiology/daily/${encodeURIComponent(selectedDate)}`}
                    variant="ghost"
                    className="border border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
                  >
                    <Heart className="mr-1 inline h-4 w-4" aria-hidden />
                    Fisiologia · giornata
                  </Pro2Link>
                </div>

                <div className="mt-4 space-y-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">Pianificato · builder</p>
                  {dayPlanned.length === 0 ? (
                    <p className="text-sm text-gray-500">Nessuna seduta pianificata.</p>
                  ) : (
                    dayPlanned.map((w) => (
                      <CalendarPlannedBuilderDetail
                        key={w.id}
                        workout={w}
                        athleteId={athleteId}
                        onDeleted={(removedId) => {
                          if (removedId) setPlanned((prev) => prev.filter((x) => x.id !== removedId));
                          void loadMonth();
                        }}
                      />
                    ))
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
                              href={`/training/session/${selectedDate}`}
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
