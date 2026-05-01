"use client";

import {
  formatExecutedWorkoutSummary,
  type ExecutedWorkout,
  type PlannedWorkout,
} from "@empathy/domain-training";
import { Activity, CalendarDays, ClipboardList, Gauge, Heart, Target, Wrench, Zap } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlannedBuilderDetail } from "@/components/training/CalendarPlannedBuilderDetail";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import type { TrainingPlannedWindowOkViewModel, TrainingTwinContextStripViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import { useActiveAthlete } from "@/lib/use-active-athlete";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type WindowErr = { ok: false; error?: string };
type SignalTone = "cyan" | "orange" | "violet" | "emerald" | "amber" | "slate";

const SIGNAL_TONE: Record<SignalTone, { border: string; bg: string; bar: string; value: string; icon: string }> = {
  cyan: {
    border: "border-cyan-500/40",
    bg: "bg-gradient-to-br from-cyan-950/45 via-slate-950/35 to-black/55",
    bar: "from-cyan-400 via-sky-300 to-cyan-600",
    value: "text-cyan-50",
    icon: "border-cyan-300/55 bg-cyan-500/35 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.35)]",
  },
  orange: {
    border: "border-orange-500/40",
    bg: "bg-gradient-to-br from-orange-950/45 via-zinc-950/35 to-black/55",
    bar: "from-orange-400 via-amber-300 to-orange-600",
    value: "text-orange-50",
    icon: "border-orange-300/55 bg-orange-500/35 text-orange-50 shadow-[0_0_16px_rgba(251,146,60,0.35)]",
  },
  violet: {
    border: "border-violet-500/40",
    bg: "bg-gradient-to-br from-violet-950/45 via-zinc-950/35 to-black/55",
    bar: "from-violet-400 via-fuchsia-300 to-violet-600",
    value: "text-violet-50",
    icon: "border-violet-300/55 bg-violet-500/35 text-violet-50 shadow-[0_0_16px_rgba(167,139,250,0.35)]",
  },
  emerald: {
    border: "border-emerald-500/40",
    bg: "bg-gradient-to-br from-emerald-950/45 via-zinc-950/35 to-black/55",
    bar: "from-emerald-400 via-teal-300 to-emerald-600",
    value: "text-emerald-50",
    icon: "border-emerald-300/55 bg-emerald-500/35 text-emerald-50 shadow-[0_0_16px_rgba(52,211,153,0.35)]",
  },
  amber: {
    border: "border-amber-500/40",
    bg: "bg-gradient-to-br from-amber-950/40 via-zinc-950/35 to-black/55",
    bar: "from-amber-300 via-orange-300 to-amber-600",
    value: "text-amber-50",
    icon: "border-amber-300/55 bg-amber-500/30 text-amber-50 shadow-[0_0_16px_rgba(245,158,11,0.3)]",
  },
  slate: {
    border: "border-white/15",
    bg: "bg-gradient-to-br from-zinc-900/60 via-slate-950/35 to-black/55",
    bar: "from-zinc-500 via-slate-300 to-zinc-700",
    value: "text-gray-100",
    icon: "border-white/20 bg-white/10 text-gray-100",
  },
};

function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes || 0));
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${safe}m`;
}

function scoreLine(value: number | null | undefined, suffix = "/100"): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : "—";
}

function adaptationLabel(score: number | null | undefined, readiness: number | null | undefined, fatigue: number | null | undefined): string {
  if (typeof fatigue === "number" && fatigue >= 75) return "Protezione";
  if (typeof readiness === "number" && readiness < 45) return "Readiness bassa";
  if (typeof score !== "number" || !Number.isFinite(score)) return "Twin parziale";
  if (score >= 75) return "Consolidamento";
  if (score >= 55) return "Adattamento utile";
  return "Da osservare";
}

function TrainingSignalCell({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: SignalTone;
  icon: typeof Activity;
}) {
  const t = SIGNAL_TONE[tone];
  return (
    <article className={`relative overflow-hidden rounded-2xl border p-4 backdrop-blur-sm ${t.border} ${t.bg}`}>
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${t.bar}`} aria-hidden />
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.18em] text-gray-500">{label}</p>
          <p className={`mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight ${t.value}`}>{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 ${t.icon}`} aria-hidden>
          <Icon className="h-5 w-5 drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]" strokeWidth={2.3} />
        </div>
      </div>
      <p className="mt-2 text-xs leading-snug text-gray-500">{detail}</p>
    </article>
  );
}

function TrainingSessionSignalPanel({
  planned,
  executed,
  readSpineCoverage,
  twinContextStrip,
}: {
  planned: PlannedWorkout[];
  executed: ExecutedWorkout[];
  readSpineCoverage: ReadSpineCoverageSummary | null;
  twinContextStrip: TrainingTwinContextStripViewModel | null;
}) {
  const plannedContracts = planned.map((w) => parsePro2BuilderSessionFromNotes(w.notes ?? null));
  const plannedMinutes = planned.reduce((sum, w, index) => {
    const summarySec = plannedContracts[index]?.summary?.durationSec;
    return sum + (typeof summarySec === "number" && Number.isFinite(summarySec) && summarySec > 0 ? summarySec / 60 : w.durationMinutes);
  }, 0);
  const plannedTss = planned.reduce((sum, w, index) => {
    const contractTss = plannedContracts[index]?.summary?.tss;
    return sum + (typeof contractTss === "number" && Number.isFinite(contractTss) && contractTss > 0 ? contractTss : w.tssTarget);
  }, 0);
  const plannedKj = planned.reduce((sum, w, index) => {
    const contractKj = plannedContracts[index]?.summary?.kj;
    return sum + (typeof contractKj === "number" && Number.isFinite(contractKj) && contractKj > 0 ? contractKj : (w.kjTarget ?? 0));
  }, 0);
  const executedMinutes = executed.reduce((sum, w) => sum + Math.max(0, w.durationMinutes || 0), 0);
  const executedTss = executed.reduce((sum, w) => sum + Math.max(0, w.tss || 0), 0);
  const executedKj = executed.reduce((sum, w) => sum + Math.max(0, w.kj ?? 0), 0);
  const tssCompletion = plannedTss > 0 ? (executedTss / plannedTss) * 100 : null;
  const durationCompletion = plannedMinutes > 0 ? (executedMinutes / plannedMinutes) * 100 : null;
  const tssDelta = executedTss - plannedTss;
  const adaptation = twinContextStrip?.adaptationScore ?? null;
  const readiness = twinContextStrip?.readiness ?? null;
  const fatigue = twinContextStrip?.fatigueAcute ?? null;
  const glycogen = twinContextStrip?.glycogenStatus ?? null;
  const adaptationState = adaptationLabel(adaptation, readiness, fatigue);
  const planLabel = plannedContracts[0]?.adaptationTarget?.replaceAll("_", " ") ?? planned[0]?.adaptiveGoal ?? planned[0]?.type ?? "—";
  const realitySources = Array.from(new Set(executed.map((w) => w.source ?? "manual"))).join(" · ") || "nessuna realtà";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TrainingSignalCell
          label="Stimolo piano"
          value={plannedTss > 0 ? `${Math.round(plannedTss)} TSS` : "—"}
          detail={`${planned.length} sedute · ${formatDuration(plannedMinutes)} · ${planLabel}`}
          tone="orange"
          icon={Target}
        />
        <TrainingSignalCell
          label="Reality load"
          value={executedTss > 0 ? `${Math.round(executedTss)} TSS` : "—"}
          detail={`${executed.length} registrazioni · ${formatDuration(executedMinutes)} · ${realitySources}`}
          tone="emerald"
          icon={Activity}
        />
        <TrainingSignalCell
          label="Aderenza"
          value={tssCompletion != null ? `${Math.round(tssCompletion)}%` : "—"}
          detail={`Δ TSS ${tssDelta >= 0 ? "+" : ""}${Math.round(tssDelta)} · durata ${durationCompletion != null ? `${Math.round(durationCompletion)}%` : "—"}`}
          tone={tssCompletion == null ? "slate" : tssCompletion < 70 || tssCompletion > 130 ? "amber" : "cyan"}
          icon={Gauge}
        />
        <TrainingSignalCell
          label="Adattamento"
          value={scoreLine(adaptation)}
          detail={`${adaptationState} · readiness ${scoreLine(readiness, "")} · fatigue ${scoreLine(fatigue, "")}`}
          tone={adaptationState === "Protezione" || adaptationState === "Readiness bassa" ? "amber" : "violet"}
          icon={Zap}
        />
      </div>

      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
        {[
          {
            id: "session",
            label: "Sessione",
            value: `${planned.length}/${executed.length}`,
            detail: "pianificate / eseguite",
            tone: "cyan" as const,
          },
          {
            id: "energy",
            label: "Energia",
            value: plannedKj || executedKj ? `${Math.round(executedKj || plannedKj)} kJ` : "—",
            detail: executedKj ? "reality kJ" : "target kJ",
            tone: "orange" as const,
          },
          {
            id: "glycogen",
            label: "Glicogeno",
            value: scoreLine(glycogen, ""),
            detail: "twin fuel availability",
            tone: "emerald" as const,
          },
          {
            id: "spine",
            label: "Read spine",
            value: readSpineCoverage ? `${readSpineCoverage.spineScore}%` : "—",
            detail: "copertura segnali atleta",
            tone: "slate" as const,
          },
          {
            id: "decision",
            label: "Decisione",
            value:
              tssCompletion == null
                ? "attesa"
                : tssCompletion < 70
                  ? "rileggi"
                  : tssCompletion > 130
                    ? "scarico"
                    : "ok",
            detail: "reality > plan",
            tone: tssCompletion != null && (tssCompletion < 70 || tssCompletion > 130) ? ("amber" as const) : ("violet" as const),
          },
        ].map((cell) => (
          <div
            key={cell.id}
            className={`min-w-[8.5rem] shrink-0 rounded-xl border bg-black/30 px-3 py-2 ${SIGNAL_TONE[cell.tone].border}`}
          >
            <div className="font-mono text-[0.62rem] font-semibold uppercase tracking-wider text-slate-500">{cell.label}</div>
            <div className="mt-1 font-mono text-base font-bold tabular-nums text-white">{cell.value}</div>
            <div className="mt-0.5 text-[0.68rem] leading-snug text-slate-500">{cell.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Vista giornata: pianificato + eseguito per `date` (stessa API finestra calendario, `from`=`to`=`date`).
 * Completion manuale e patch coach arriveranno con endpoint dedicati Pro 2.
 */
export default function TrainingSessionPageView() {
  const params = useParams<{ date: string }>();
  const date = typeof params?.date === "string" ? params.date : "";
  const dateValid = ISO_DATE.test(date);

  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [planned, setPlanned] = useState<PlannedWorkout[]>([]);
  const [executed, setExecuted] = useState<ExecutedWorkout[]>([]);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [twinContextStrip, setTwinContextStrip] = useState<TrainingTwinContextStripViewModel | null>(null);
  const [plannedProvenanceSummary, setPlannedProvenanceSummary] = useState<Partial<Record<string, number>> | null>(null);

  useEffect(() => {
    if (!dateValid) {
      setLoading(false);
      setErr(null);
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setPlannedProvenanceSummary(null);
      return;
    }
    if (ctxLoading) return;
    if (!athleteId) {
      setLoading(false);
      setPlanned([]);
      setExecuted([]);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setPlannedProvenanceSummary(null);
      setErr("Nessun atleta attivo.");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const q = new URLSearchParams({ athleteId, from: date, to: date });
        const res = await fetch(`/api/training/planned-window?${q}`, {
          cache: "no-store",
          headers: await buildSupabaseAuthHeaders(),
        });
        const json = (await res.json()) as TrainingPlannedWindowOkViewModel | WindowErr;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setPlanned([]);
          setExecuted([]);
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
          setPlannedProvenanceSummary(null);
          setErr(("error" in json && json.error) || "Lettura non riuscita.");
          return;
        }
        setPlanned(json.planned);
        setExecuted(json.executed);
        setReadSpineCoverage(json.readSpineCoverage ?? null);
        setTwinContextStrip(json.twinContextStrip ?? null);
        setPlannedProvenanceSummary(json.plannedProvenanceSummary ?? null);
      } catch {
        if (!cancelled) {
          setErr("Errore di rete.");
          setPlanned([]);
          setExecuted([]);
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
          setPlannedProvenanceSummary(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [athleteId, ctxLoading, date, dateValid]);

  const titleDate = useMemo(() => {
    if (!dateValid) return "—";
    try {
      return new Date(`${date}T12:00:00`).toLocaleDateString("it-IT", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return date;
    }
  }, [date, dateValid]);

  return (
    <Pro2ModulePageShell
      eyebrow="Training · Giornata"
      eyebrowClassName="text-orange-400"
      title={dateValid ? titleDate : "Data non valida"}
      description={
        dateValid ? (
          <span>
            Riferimento ISO <code className="text-orange-200/80">{date}</code> — stessi dati del calendario operativo.
          </span>
        ) : (
          "Usa un path del tipo /training/session/2025-04-02 (YYYY-MM-DD)."
        )
      }
      headerActions={
        <>
          <Pro2Link
            href={dateValid ? `/training/calendar?date=${encodeURIComponent(date)}` : "/training/calendar"}
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
          <Pro2Link
            href="/training"
            variant="ghost"
            className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
          >
            Hub
          </Pro2Link>
          <Pro2Link
            href="/profile"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Profile
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        <TrainingSubnav />
      </div>

      {dateValid && readSpineCoverage && athleteId ? (
        <TrainingPlannedWindowContextStrip
          className="mb-4"
          label="Giornata"
          readSpineCoverage={readSpineCoverage}
          twinContextStrip={twinContextStrip}
          athleteId={athleteId}
          plannedProvenanceSummary={plannedProvenanceSummary}
        />
      ) : null}

      {!dateValid ? (
        <Pro2SectionCard accent="slate" title="Path non valido" subtitle="Formato data" icon={CalendarDays}>
          <p className="text-sm text-gray-400">
            La data nell&apos;URL deve essere <strong className="text-gray-200">YYYY-MM-DD</strong>.
          </p>
        </Pro2SectionCard>
      ) : null}

      {dateValid ? (
        <>
          <Pro2SectionCard
            accent="orange"
            title="Bioenergetis sessione"
            subtitle="Celle operative: piano, realtà, twin e adattamento"
            icon={Activity}
          >
            {ctxLoading || loading ? (
              <p className="text-sm text-gray-500">Caricamento segnali sessione…</p>
            ) : err ? (
              <p className="text-sm text-amber-300/90" role="alert">
                {err}
              </p>
            ) : (
              <TrainingSessionSignalPanel
                planned={planned}
                executed={executed}
                readSpineCoverage={readSpineCoverage}
                twinContextStrip={twinContextStrip}
              />
            )}
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="cyan"
            title="Pianificato"
            subtitle={ctxLoading || loading ? "Caricamento…" : err ? undefined : `${planned.length} in questa giornata`}
            icon={CalendarDays}
          >
            {err ? (
              <p className="text-sm text-amber-300/90" role="alert">
                {err}
              </p>
            ) : null}
            {!ctxLoading && !loading && !err && planned.length === 0 ? (
              <p className="text-sm text-gray-500">Nessun workout pianificato per questa data.</p>
            ) : null}
            {!ctxLoading && !loading && !err && planned.length > 0 ? (
              <ul className="space-y-4">
                {planned.map((w) => (
                  <li key={w.id}>
                    <CalendarPlannedBuilderDetail workout={w} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="emerald"
            title="Eseguito"
            subtitle={!loading && !err ? `${executed.length} registrazioni` : undefined}
            icon={ClipboardList}
          >
            {!ctxLoading && !loading && !err && executed.length === 0 ? (
              <p className="text-sm text-gray-500">Nessuna esecuzione in questa giornata.</p>
            ) : null}
            {!ctxLoading && !loading && !err && executed.length > 0 ? (
              <ul className="space-y-2">
                {executed.map((w) => (
                  <li
                    key={w.id}
                    className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-200"
                  >
                    {formatExecutedWorkoutSummary(w)}
                  </li>
                ))}
              </ul>
            ) : null}
          </Pro2SectionCard>

          <Pro2SectionCard
            accent="violet"
            title="Twin e recovery"
            subtitle="Stesso athlete memory usato da builder e nutrizione"
            icon={Heart}
          >
            <p className="text-sm text-gray-400">
              Readiness, carico interno e recovery debt vivono nel <strong className="text-gray-200">digital twin</strong> in memoria
              atleta. Apri Profile per lo snapshot; Physiology per le ancore deterministiche.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pro2Link
                href="/profile"
                variant="secondary"
                className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
              >
                Profile · twin
              </Pro2Link>
              <Pro2Link
                href="/physiology"
                variant="secondary"
                className="justify-center border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15"
              >
                Physiology
              </Pro2Link>
            </div>
          </Pro2SectionCard>

          <Pro2SectionCard accent="amber" title="Prossimi passi" subtitle="API Pro 2" icon={Wrench}>
            <p className="text-sm text-gray-400">
              Registrazione <strong className="text-gray-200">completa sessione</strong>, modifica carico coach e note builder strutturate
              saranno collegate agli stessi endpoint previsti in V1, senza motore parallelo.
            </p>
          </Pro2SectionCard>
        </>
      ) : null}
    </Pro2ModulePageShell>
  );
}
