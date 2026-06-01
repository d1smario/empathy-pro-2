"use client";

import type { PlannedWorkout } from "@empathy/domain-training";
import { BuilderPlannedSessionViz } from "@/components/training/BuilderPlannedSessionViz";
import { Pro2GymSchedaBlockList } from "@/components/training/Pro2GymSchedaBlockList";
import { SessionMultilevelAnalysisStrip } from "@/components/training/SessionMultilevelAnalysisStrip";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { StructuredWorkoutStepTable } from "@/components/training/StructuredWorkoutStepTable";
import { pro2BuilderContractToStructuredIntervalRows } from "@/lib/training/planned-structured-export";
import { LifestylePracticeMediaThumb } from "@/components/training/LifestylePracticeMediaThumb";
import { Pro2Link } from "@/components/ui/empathy";
import {
  effectiveDurationMinutesFromPro2Contract,
  effectiveTssDisplayFromPro2Contract,
  estimatedTssFromPro2Contract,
  parsePro2BuilderSessionFromNotes,
  pro2BuilderContractToChartSegments,
} from "@/lib/training/builder/pro2-session-notes";
import type { LifestylePracticeCategory } from "@/lib/training/builder/lifestyle-playbook-catalog";
import { PlannedSessionKpiStrip } from "@/components/training/PlannedSessionKpiStrip";
import { resolvePlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";
import { contractHasGymScheda } from "@/lib/training/planned-workout-display";
import { ChevronDown, Copy, ExternalLink, Trash2, Download, ArrowRightLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useProductHref } from "@/lib/shell/use-product-href";

const LIFESTYLE_CATS: readonly LifestylePracticeCategory[] = [
  "yoga",
  "pilates",
  "breath",
  "meditation",
  "mobility",
  "stretch",
];

function formatSegDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  if (s === 0) return `${m}′`;
  return `${m}′${String(s).padStart(2, "0")}″`;
}

function asLifestyleCategory(raw: string | undefined): LifestylePracticeCategory {
  if (raw && (LIFESTYLE_CATS as readonly string[]).includes(raw)) return raw as LifestylePracticeCategory;
  return "mobility";
}
import { deletePlannedWorkout, patchPlannedWorkout } from "@/modules/training/services/training-planned-api";
import { extractViryaTagFromPlannedNotes, planNameFromViryaTag } from "@/lib/training/virya/virya-planned-notes";
import { writeViryaCalendarTombstone } from "@/lib/training/virya/virya-calendar-tombstone";
import { clonePlannedWorkout } from "@/modules/training/services/training-library-api";

function familyLabel(family: string | undefined): string {
  switch (family) {
    case "aerobic":
      return "Aerobico";
    case "strength":
      return "Gym / forza";
    case "technical":
      return "Tecnico";
    case "lifestyle":
      return "Lifestyle";
    default:
      return family ?? "Sessione";
  }
}

const familyBadgeClass: Record<string, string> = {
  aerobic: "border-cyan-400/50 bg-cyan-500/15 text-cyan-100",
  strength: "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100",
  technical: "border-violet-400/50 bg-violet-500/15 text-violet-100",
  lifestyle: "border-emerald-400/50 bg-emerald-500/15 text-emerald-100",
};

export function CalendarPlannedBuilderDetail({
  workout,
  athleteId,
  athleteFtpWatts,
  onDeleted,
  onCalendarMutated,
}: {
  workout: PlannedWorkout;
  athleteId?: string | null;
  athleteFtpWatts?: number | null;
  onDeleted?: (removedPlannedId: string) => void;
  onCalendarMutated?: () => void;
}) {
  const contract = useMemo(() => parsePro2BuilderSessionFromNotes(workout.notes ?? null), [workout.notes]);

  const segments = useMemo(() => (contract ? pro2BuilderContractToChartSegments(contract) : []), [contract]);

  const stepRows = useMemo(
    () =>
      contract && contract.family === "aerobic" && contract.renderProfile?.intensityUnit === "watt"
        ? pro2BuilderContractToStructuredIntervalRows(contract)
        : [],
    [contract],
  );

  const hasBlockChart = segments.length > 0 && contract?.family !== "strength";
  const router = useRouter();
  const [structureOpen, setStructureOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [adaptNavigating, setAdaptNavigating] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [targetDate, setTargetDate] = useState(workout.date);
  const [calendarBusy, setCalendarBusy] = useState<"copy" | "move" | null>(null);
  const [calendarActionMsg, setCalendarActionMsg] = useState<string | null>(null);
  const [moveConfirmOpen, setMoveConfirmOpen] = useState(false);

  const resolvedAthleteId = (workout.athleteId?.trim() || athleteId?.trim() || "").trim();
  const viryaTag = useMemo(() => extractViryaTagFromPlannedNotes(workout.notes ?? null), [workout.notes]);
  const isViryaSession = viryaTag != null;

  useEffect(() => {
    setTargetDate(workout.date);
    setDeleteConfirmOpen(false);
    setMoveConfirmOpen(false);
    setActionFeedback(null);
    setAdaptNavigating(false);
  }, [workout.id, workout.date]);

  const tssEst = useMemo(() => (contract ? estimatedTssFromPro2Contract(contract) : 0), [contract]);

  const titleDurationMin = useMemo(
    () => effectiveDurationMinutesFromPro2Contract(contract, workout.durationMinutes),
    [contract, workout.durationMinutes],
  );
  const titleTss = useMemo(
    () => effectiveTssDisplayFromPro2Contract(contract, workout.tssTarget),
    [contract, workout.tssTarget],
  );
  const sessionMetrics = useMemo(
    () =>
      resolvePlannedSessionMetrics({
        contract,
        durationMinutesDb: workout.durationMinutes,
        tssTargetDb: workout.tssTarget,
        kcalTargetDb: workout.kcalTarget,
        kjTargetDb: workout.kjTarget,
        athleteFtpWatts,
      }),
    [contract, workout.durationMinutes, workout.tssTarget, workout.kcalTarget, workout.kjTarget, athleteFtpWatts],
  );
  const titleKcal = sessionMetrics.kcal > 0 ? sessionMetrics.kcal : null;
  const chartFtpW = athleteFtpWatts ?? contract?.renderProfile?.ftpW;

  const sessionHref = useProductHref(`/training/session/${workout.date}`);
  const builderHref = `/training/builder?date=${encodeURIComponent(workout.date)}&replace_planned_id=${encodeURIComponent(workout.id)}`;

  const exportAid = resolvedAthleteId;
  const exportHref = (fmt: string) =>
    exportAid
      ? `/api/training/planned/${encodeURIComponent(workout.id)}/export?athleteId=${encodeURIComponent(exportAid)}&format=${fmt}`
      : null;
  const canStructuredExport =
    !!contract && contract.family === "aerobic" && contract.renderProfile?.intensityUnit === "watt";

  const family = contract?.family;
  const gymScheda = contract && family === "strength" ? contractHasGymScheda(contract) : false;

  return (
    <article className="rounded-2xl border border-white/10 bg-black/35 p-4 shadow-inner">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${family ? familyBadgeClass[family] ?? "border-white/20 bg-white/5 text-gray-300" : "border-white/20 bg-white/5 text-gray-400"}`}
            >
              {contract ? familyLabel(family) : "Pianificato"}
            </span>
            {typeof workout.notes === "string" && workout.notes.includes("[STRUCTURED_PLAN_IMPORT]") ? (
              <span className="rounded-full border border-sky-400/45 bg-sky-500/15 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-sky-100">
                Import strutturato
              </span>
            ) : null}
            <span className="font-mono text-xs text-gray-500">{workout.type}</span>
          </div>
          <h4 className="mt-1.5 text-base font-bold text-white">
            {contract?.sessionName?.trim() || workout.type} · {titleDurationMin}′ · Carico {titleTss}
            {titleKcal != null && titleKcal > 0 ? ` · kcal ${titleKcal}` : ""}
          </h4>
          {contract?.discipline ? (
            <p className="mt-0.5 text-xs text-gray-500">
              {contract.discipline}
              {contract.adaptationTarget ? ` · ${contract.adaptationTarget}` : ""}
              {contract.phase ? ` · fase ${contract.phase}` : ""}
            </p>
          ) : null}
        </div>
        <div className="relative z-20 flex flex-wrap gap-2 pointer-events-auto">
          <Pro2Link href={sessionHref} variant="ghost" className="border border-orange-500/35 bg-orange-500/10 text-xs">
            Giornata
            <ExternalLink className="ml-1 inline h-3 w-3 opacity-70" aria-hidden />
          </Pro2Link>
          <button
            type="button"
            disabled={adaptNavigating}
            className="inline-flex items-center justify-center rounded-full border border-fuchsia-500/35 bg-fuchsia-500/10 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-fuchsia-500/20 disabled:opacity-40"
            title="Apre il builder con adattamento giornaliero e sostituisce questa riga al salvataggio."
            onClick={() => {
              setActionFeedback(null);
              setAdaptNavigating(true);
              router.push(builderHref);
            }}
          >
            {adaptNavigating ? "Apertura builder…" : "Adatta"}
          </button>
          {resolvedAthleteId ? (
            deleteConfirmOpen ? (
              <div className="flex max-w-md flex-col gap-2 rounded-lg border border-rose-400/40 bg-rose-950/40 px-2 py-2">
                <span className="text-xs text-rose-100">
                  {isViryaSession
                    ? `Seduta VIRYA (${planNameFromViryaTag(viryaTag)}). Non è memoria AI: è una riga in planned_workouts.`
                    : "Rimuovere dal calendario?"}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={deleting}
                    className="rounded-lg border border-rose-300/50 bg-rose-500/25 px-2 py-1 text-xs font-bold text-white hover:bg-rose-500/40 disabled:opacity-40"
                    onClick={async () => {
                      const aid = resolvedAthleteId;
                      setActionFeedback(null);
                      setDeleting(true);
                      try {
                        const r = await deletePlannedWorkout({
                          id: workout.id,
                          athleteId: aid,
                          purgeViryaDayDuplicates: isViryaSession,
                        });
                        setDeleteConfirmOpen(false);
                        const extra =
                          r.purgedViryaDayDuplicates && r.purgedViryaDayDuplicates > 0
                            ? ` (+${r.purgedViryaDayDuplicates} duplicati VIRYA stesso giorno)`
                            : "";
                        setActionFeedback({ tone: "ok", text: `Seduta rimossa dal calendario.${extra}` });
                        onDeleted?.(workout.id);
                      } catch (e) {
                        setActionFeedback({
                          tone: "err",
                          text: e instanceof Error ? e.message : "Eliminazione non riuscita",
                        });
                      } finally {
                        setDeleting(false);
                      }
                    }}
                  >
                    {deleting ? "Elimino…" : isViryaSession ? "Solo questo giorno" : "Conferma"}
                  </button>
                  {isViryaSession && viryaTag ? (
                    <button
                      type="button"
                      disabled={deleting}
                      className="rounded-lg border border-amber-400/45 bg-amber-500/20 px-2 py-1 text-xs font-bold text-amber-100 hover:bg-amber-500/30 disabled:opacity-40"
                      title="Rimuove tutte le sedute con lo stesso tag VIRYA sul calendario"
                      onClick={async () => {
                        setActionFeedback(null);
                        setDeleting(true);
                        try {
                          const r = await deletePlannedWorkout({
                            id: workout.id,
                            athleteId: resolvedAthleteId,
                            deleteViryaPlanTag: viryaTag,
                          });
                          writeViryaCalendarTombstone(resolvedAthleteId, viryaTag);
                          const n = r.deletedViryaPlanRows ?? 0;
                          setDeleteConfirmOpen(false);
                          setActionFeedback({
                            tone: "ok",
                            text: `Piano VIRYA rimosso (${n} sedute). Per ripubblicare: VIRYA → Salva su Calendar.`,
                          });
                          onDeleted?.(workout.id);
                          onCalendarMutated?.();
                        } catch (e) {
                          setActionFeedback({
                            tone: "err",
                            text: e instanceof Error ? e.message : "Eliminazione piano VIRYA non riuscita",
                          });
                        } finally {
                          setDeleting(false);
                        }
                      }}
                    >
                      Tutto il piano VIRYA
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={deleting}
                    className="rounded-lg border border-white/15 px-2 py-1 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-40"
                    onClick={() => setDeleteConfirmOpen(false)}
                  >
                    Annulla
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/45 bg-rose-500/15 px-2.5 py-1.5 text-xs font-bold text-rose-100 hover:bg-rose-500/25 disabled:opacity-40"
                title="Rimuove questa riga da planned_workouts"
                onClick={() => {
                  setActionFeedback(null);
                  setDeleteConfirmOpen(true);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Elimina
              </button>
            )
          ) : (
            <span className="text-xs text-amber-200/90">Elimina: contesto atleta non disponibile.</span>
          )}
        </div>
      </div>

      {actionFeedback ? (
        <p
          className={`mt-2 text-xs ${actionFeedback.tone === "ok" ? "text-emerald-300/95" : "text-rose-300/95"}`}
          role="status"
        >
          {actionFeedback.text}
        </p>
      ) : null}

      {resolvedAthleteId ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-white/10 pt-3">
          <label className="flex flex-col gap-1 text-[0.65rem] text-gray-500">
            Data destinazione
            <input
              type="date"
              className="rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-sm text-white"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={calendarBusy != null}
            />
          </label>
          <button
            type="button"
            disabled={calendarBusy != null || !targetDate.trim()}
            className="inline-flex items-center gap-1 rounded-lg border border-violet-400/45 bg-violet-500/15 px-2.5 py-1.5 text-xs font-bold text-violet-100 hover:bg-violet-500/25 disabled:opacity-40"
            title="Duplica la seduta su un'altra data (la riga originale resta invariata)"
            onClick={async () => {
              setCalendarActionMsg(null);
              setCalendarBusy("copy");
              try {
                const r = await clonePlannedWorkout({
                  sourceId: workout.id,
                  athleteId: resolvedAthleteId,
                  date: targetDate.trim(),
                });
                if (!r.ok) throw new Error(r.error ?? "Copia non riuscita");
                setCalendarActionMsg(`Copiata al ${targetDate.trim()}`);
                onCalendarMutated?.();
              } catch (e) {
                setCalendarActionMsg(e instanceof Error ? e.message : "Copia non riuscita");
              } finally {
                setCalendarBusy(null);
              }
            }}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {calendarBusy === "copy" ? "Copio…" : "Copia"}
          </button>
          {moveConfirmOpen ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-950/30 px-2 py-1.5">
              <span className="text-xs text-cyan-100">
                Spostare dal {workout.date} al {targetDate.trim()}?
              </span>
              <button
                type="button"
                disabled={calendarBusy != null}
                className="rounded-lg border border-cyan-300/50 bg-cyan-500/25 px-2 py-1 text-xs font-bold text-white disabled:opacity-40"
                onClick={async () => {
                  setCalendarActionMsg(null);
                  setCalendarBusy("move");
                  try {
                    await patchPlannedWorkout({
                      id: workout.id,
                      athleteId: resolvedAthleteId,
                      patch: { date: targetDate.trim() },
                    });
                    setMoveConfirmOpen(false);
                    setCalendarActionMsg(`Spostata al ${targetDate.trim()}`);
                    onCalendarMutated?.();
                  } catch (e) {
                    setCalendarActionMsg(e instanceof Error ? e.message : "Spostamento non riuscito");
                  } finally {
                    setCalendarBusy(null);
                  }
                }}
              >
                {calendarBusy === "move" ? "Sposto…" : "Conferma"}
              </button>
              <button
                type="button"
                disabled={calendarBusy != null}
                className="rounded-lg border border-white/15 px-2 py-1 text-xs text-gray-300 hover:bg-white/10 disabled:opacity-40"
                onClick={() => setMoveConfirmOpen(false)}
              >
                Annulla
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={calendarBusy != null || !targetDate.trim() || targetDate.trim() === workout.date}
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/45 bg-cyan-500/15 px-2.5 py-1.5 text-xs font-bold text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-40"
              title="Sposta la seduta su un'altra data"
              onClick={() => {
                setCalendarActionMsg(null);
                setMoveConfirmOpen(true);
              }}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
              Sposta
            </button>
          )}
          {calendarActionMsg ? (
            <p className="w-full text-xs text-emerald-300/90" role="status">
              {calendarActionMsg}
            </p>
          ) : null}
        </div>
      ) : null}

      {exportAid && contract ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <span className="flex items-center gap-1 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-zinc-500">
            <Download className="h-3 w-3 shrink-0" aria-hidden />
            Export device
          </span>
          {canStructuredExport ? (
            <>
              <Pro2Link
                href={exportHref("zwo")!}
                variant="ghost"
                className="border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
              >
                ZWO
              </Pro2Link>
              <Pro2Link
                href={exportHref("fit_workout")!}
                variant="ghost"
                className="border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
              >
                FIT
              </Pro2Link>
              <Pro2Link
                href={exportHref("interval_csv")!}
                variant="ghost"
                className="border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-xs text-cyan-100"
              >
                CSV
              </Pro2Link>
            </>
          ) : (
            <span className="text-xs text-zinc-500">ZWO/FIT/CSV: richiede macro aerobico + watt.</span>
          )}
          <Pro2Link
            href={exportHref("fueling_json")!}
            variant="ghost"
            className="border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100"
          >
            Fueling JSON
          </Pro2Link>
        </div>
      ) : null}

      {!contract ? (
        <p className="mt-3 text-sm text-gray-500">
          Nessun contratto Builder in <code className="text-gray-600">notes</code> (tipico import TrainingPeaks / CSV: solo
          riepilogo). Il grafico a blocchi e le zone compaiono dopo aver definito la sessione nel Builder — usa{" "}
          <span className="text-gray-400">Modifica</span> qui sopra.
        </p>
      ) : (
        <>
          {family === "strength" ? (
            <div
              id="calendar-gym-scheda"
              className="mt-4 scroll-mt-28 rounded-2xl border border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-950/30 via-violet-950/20 to-black/50 p-4 shadow-[0_0_32px_-12px_rgba(217,70,239,0.35)]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-fuchsia-200">Scheda palestra · come Builder</p>
              <div className="mt-4">
                <Pro2GymSchedaBlockList contract={contract} />
              </div>
              {!gymScheda ? (
                <p className="mt-3 text-xs text-amber-200/90">
                  Questa seduta non ha ancora esercizi catalogo (<code className="text-amber-100/80">gymRx</code>). In VIRYA
                  imposta un nome piano, rigenera e ripubblica su Calendar, oppure apri <span className="text-white">Adatta</span> nel
                  Builder.
                </p>
              ) : null}
            </div>
          ) : null}

          {hasBlockChart ? (
            <div className="mt-4 space-y-4">
              <PlannedSessionKpiStrip metrics={sessionMetrics} />
              <SessionBlockIntensityChart
                segments={segments}
                title={
                  family === "aerobic"
                    ? "Grafico a blocchi (pianificato)"
                    : "Proxy tempo / carico (stima)"
                }
                estimatedTss={tssEst > 0 ? tssEst : undefined}
              />
              {stepRows.length > 0 ? (
                <StructuredWorkoutStepTable
                  rows={stepRows}
                  ftpW={chartFtpW}
                  compact
                  title="Workout details"
                />
              ) : null}
              <SessionMultilevelAnalysisStrip
                contract={contract}
                fallbackTss={titleTss}
                fallbackDurationMin={titleDurationMin}
                compact
              />
            </div>
          ) : contract && (contract.blocks ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-amber-200/90">
              Contratto Builder senza blocchi: apri <span className="text-white">Adatta</span> nel Builder e salva di nuovo, oppure
              rigenera da VIRYA su Calendar.
            </p>
          ) : null}

          <details
            className="mt-4 rounded-xl border border-white/10 bg-black/25"
            open={structureOpen}
            onToggle={(e) => setStructureOpen(e.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-gray-200 marker:hidden [&::-webkit-details-marker]:hidden">
              <span>
                {family === "strength"
                  ? "Dettaglio tecnico · lista blocchi"
                  : hasBlockChart
                    ? "Dettaglio blocchi · note"
                    : "Struttura · apri / chiudi"}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${structureOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
            </summary>
            <div className="space-y-4 border-t border-white/10 px-3 pb-4 pt-3">
              {family === "strength" && !gymScheda && segments.length > 0 && !hasBlockChart ? (
                <SessionBlockIntensityChart
                  segments={segments}
                  title="Proxy tempo / carico (stima — senza scheda)"
                  estimatedTss={tssEst > 0 ? tssEst : undefined}
                />
              ) : null}

              {!hasBlockChart ? (
                <BuilderPlannedSessionViz contract={contract} title="Profilo zone (builder V1)" compact />
              ) : null}

              {!hasBlockChart ? (
                <SessionMultilevelAnalysisStrip
                  contract={contract}
                  fallbackTss={titleTss}
                  fallbackDurationMin={titleDurationMin}
                  compact
                />
              ) : null}

              {family !== "strength" && !hasBlockChart ? (
                <ul className="flex flex-col gap-3">
                  {(contract.blocks ?? []).map((block, idx) => (
                    <li
                      key={block.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-200"
                    >
                      <div className="flex flex-wrap gap-3">
                        {family === "lifestyle" && block.lifestyleRx ? (
                          <LifestylePracticeMediaThumb
                            src={block.lifestyleRx.mediaUrl ?? null}
                            practiceCategory={asLifestyleCategory(block.lifestyleRx.practiceCategory)}
                            alt={block.label}
                            playbookItemId={block.lifestyleRx.playbookItemId ?? null}
                            fallbackLabel={block.label}
                            className="h-20 w-20 shrink-0 rounded-lg border border-emerald-500/25"
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white">
                            {idx + 1}. {block.label}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {block.kind}
                            {" · "}
                            {block.durationMinutes}′
                            {block.intensityCue ? (
                              <>
                                {" "}
                                · <span className="text-gray-400">{block.intensityCue}</span>
                              </>
                            ) : null}
                          </p>
                          {block.technicalRx ? (
                            <p className="mt-2 text-xs text-violet-200/85">
                              {block.technicalRx.entryType === "scheme" ? "Schema" : "Drill"}
                              {block.technicalRx.periodsLabel ? ` · ${block.technicalRx.periodsLabel}` : ""}
                              {block.technicalRx.spaceLabel ? ` · ${block.technicalRx.spaceLabel}` : ""}
                              {block.technicalRx.coachingCue ? ` · ${block.technicalRx.coachingCue}` : ""}
                            </p>
                          ) : null}
                          {block.lifestyleRx ? (
                            <p className="mt-2 text-xs text-emerald-200/85">
                              {block.lifestyleRx.rounds != null ? `${block.lifestyleRx.rounds} round` : ""}
                              {block.lifestyleRx.holdOrReps ? ` · ${block.lifestyleRx.holdOrReps}` : ""}
                              {block.lifestyleRx.restSec != null ? ` · rec ${block.lifestyleRx.restSec}s` : ""}
                              {block.lifestyleRx.breathPattern ? ` · ${block.lifestyleRx.breathPattern}` : ""}
                            </p>
                          ) : null}
                          {block.notes ? <p className="mt-2 text-xs text-gray-500">{block.notes}</p> : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </details>
        </>
      )}
    </article>
  );
}
