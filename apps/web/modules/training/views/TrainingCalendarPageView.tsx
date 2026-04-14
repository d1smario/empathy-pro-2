"use client";

import type { ExecutedWorkout, PlannedWorkout } from "@empathy/domain-training";
import { formatExecutedWorkoutSummary } from "@empathy/domain-training";
import { Activity, CalendarDays, FileUp, LineChart, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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
  const [showFileImport, setShowFileImport] = useState(false);
  const [fileImportForm, setFileImportForm] = useState({
    mode: "executed" as "executed" | "planned",
    date: "",
    device: "auto",
    notes: "",
    file: null as File | null,
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

  const loadMonth = useCallback(async () => {
    if (ctxLoading) return;
    if (!athleteId) {
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setErr("Nessun atleta attivo.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ athleteId, from: fetchFrom, to: fetchTo });
      const res = await fetch(`/api/training/planned-window?${q}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: await buildSupabaseAuthHeaders(),
      });
      const json = (await res.json()) as TrainingPlannedWindowOkViewModel | { ok: false; error?: string };
      if (!res.ok || !json.ok) {
        setPlanned([]);
        setExecuted([]);
        setReadSpineCoverage(null);
        setTwinContextStrip(null);
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
      setFetchDiag({
        status: res.status,
        plannedN: p.length,
        executedN: ex.length,
        resFrom: json.from,
        resTo: json.to,
      });
    } catch {
      setErr("Errore di rete.");
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setFetchDiag({ status: 0, plannedN: 0, executedN: 0, apiError: "network" });
    } finally {
      setLoading(false);
    }
  }, [athleteId, ctxLoading, fetchFrom, fetchTo]);

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
    setSaving(true);
    setErr(null);
    setSuccess(null);
    try {
      if (fileImportForm.mode === "planned") {
        const json = await importPlannedProgramFile({
          athleteId,
          file: fileImportForm.file,
          notes: fileImportForm.notes || undefined,
        });
        const n = typeof json.importedCount === "number" ? json.importedCount : 0;
        setSuccess(`Programmazione importata: ${n} sedute.`);
        const fd = json.firstDate;
        if (fd && /^\d{4}-\d{2}-\d{2}$/.test(fd)) {
          setSelectedDate(fd);
          const d = new Date(`${fd}T12:00:00`);
          setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
        }
      } else {
        const json = await importExecutedWorkoutFile({
          athleteId,
          file: fileImportForm.file,
          date: fileImportForm.date || undefined,
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
      }
      setFileImportForm((f) => ({ ...f, file: null }));
      await loadMonth();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Errore in fase di import.");
    } finally {
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
            onClick={() => setShowFileImport((v) => !v)}
          >
            {showFileImport ? "Chiudi import" : "Importa file"}
          </button>
        </div>
        <p className="font-mono text-xs text-gray-500" title="Finestra API (include margine oltre il mese della griglia)">
          {fetchFrom} → {fetchTo} · griglia {monthFrom}…{monthTo}
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
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,420px)]">
            <div className="space-y-6">
              {showFileImport ? (
                <Pro2SectionCard accent="violet" title="Import da file" subtitle="FIT · TCX · GPX · CSV · JSON (come V1)" icon={FileUp}>
                  <form onSubmit={handleFileImportSubmit} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Modalità
                    <select
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                      value={fileImportForm.mode}
                      onChange={(e) =>
                        setFileImportForm((f) => ({ ...f, mode: e.target.value as "executed" | "planned" }))
                      }
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
                      fileImportForm.mode === "planned" ? ".csv,.json" : ".csv,.json,.tcx,.gpx,.fit,.fit.gz,.gz"
                    }
                    onChange={(e) => setFileImportForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
                  />
                </label>
                {fileImportForm.mode === "executed" ? (
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Data override (opzionale)
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
                      value={fileImportForm.date}
                      onChange={(e) => setFileImportForm((f) => ({ ...f, date: e.target.value }))}
                    />
                  </label>
                ) : null}
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
                    ? "Programmazione: CSV/JSON (export TrainingPeaks). Righe → planned_workouts."
                    : "Eseguito: FIT/FIT.GZ, CSV, JSON, TCX, GPX (Garmin, Wahoo, Suunto, Polar, COROS, Karoo, Apple export, Zwift, Strava, TP…). Device: auto o manuale. Se manca la data, usa override."}
                </p>
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
              ) : null}

              {!showFileImport ? (
                <Pro2SectionCard accent="cyan" title="Import veloce" subtitle="Apri il pannello Importa file nella barra mese" icon={FileUp}>
                  <p className="text-sm text-slate-400">
                    Usa il pulsante <strong className="text-slate-200">Importa file</strong> sopra per caricare FIT/TCX/GPX o la programmazione CSV/JSON.
                  </p>
                </Pro2SectionCard>
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

                <div className="mt-4 space-y-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">Pianificato · builder</p>
                  {dayPlanned.length === 0 ? (
                    <p className="text-sm text-gray-500">Nessuna seduta pianificata.</p>
                  ) : (
                    dayPlanned.map((w) => <CalendarPlannedBuilderDetail key={w.id} workout={w} />)
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
