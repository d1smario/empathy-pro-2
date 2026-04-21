"use client";

import type { TrainingTwinContextStripViewModel } from "@/api/training/contracts";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import { formatPlannedProvenanceSummaryIt } from "@/lib/training/planned-provenance";
import { cn } from "@/lib/cn";

type Props = {
  readSpineCoverage: ReadSpineCoverageSummary | null;
  twinContextStrip: TrainingTwinContextStripViewModel | null;
  className?: string;
  /** Etichetta breve nel summary (es. "Calendario", "Giornata", "Builder"). */
  label?: string;
  /** Stesso `athleteId` della query `planned-window` (diagnostica / confronto DB). */
  athleteId?: string | null;
  /** Da `planned-window` → `plannedProvenanceSummary` (demo / builder / import coach). */
  plannedProvenanceSummary?: Partial<Record<string, number>> | null;
};

function twinLine(t: TrainingTwinContextStripViewModel): string {
  const bits: string[] = [];
  if (t.readiness != null) bits.push(`readiness ${Math.round(t.readiness)}`);
  if (t.fatigueAcute != null) bits.push(`fatigue ${Math.round(t.fatigueAcute)}`);
  if (t.glycogenStatus != null) bits.push(`glycogen ${Math.round(t.glycogenStatus)}`);
  if (t.adaptationScore != null) bits.push(`adapt ${Math.round(t.adaptationScore)}`);
  return bits.length ? bits.join(" · ") : "Twin presente (metriche parziali).";
}

/**
 * Contesto opzionale da `GET /api/training/planned-window`: read-spine + strip twin.
 */
export function TrainingPlannedWindowContextStrip({
  readSpineCoverage,
  twinContextStrip,
  className,
  label = "Training",
  athleteId,
  plannedProvenanceSummary,
}: Props) {
  if (!readSpineCoverage) return null;

  const aid = athleteId?.trim() ?? "";
  const showProv = plannedProvenanceSummary != null;

  return (
    <details
      className={cn(
        "rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-300",
        className,
      )}
    >
      <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-wider text-sky-300/90">
        {label} · spina lettura {readSpineCoverage.spineScore}%
        {twinContextStrip ? " · twin" : ""}
      </summary>
      {aid ? (
        <p className="mt-2 break-all font-mono text-[0.6rem] leading-snug text-slate-500" title="athlete_id usato da planned-window">
          atleta {aid}
        </p>
      ) : null}
      {showProv ? (
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Origine pianificati · </span>
          {formatPlannedProvenanceSummaryIt(plannedProvenanceSummary)}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {(
          [
            ["Profilo", readSpineCoverage.hasProfile],
            ["Fisiologia", readSpineCoverage.hasPhysiology],
            ["Twin", readSpineCoverage.hasTwin],
            ["Nutrizione", readSpineCoverage.hasNutritionConstraints || readSpineCoverage.hasNutritionDiary],
            ["Health", readSpineCoverage.hasHealthPanels],
            ["Ingest", readSpineCoverage.hasRealityIngestions],
          ] as const
        ).map(([name, on]) => (
          <span
            key={name}
            className={cn(
              "rounded-full px-2 py-0.5 font-mono text-[0.6rem]",
              on ? "bg-emerald-500/15 text-emerald-200/90" : "bg-white/5 text-slate-500",
            )}
          >
            {name}
          </span>
        ))}
      </div>
      {twinContextStrip ? (
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-400">Twin · </span>
          {twinLine(twinContextStrip)}
          {twinContextStrip.asOf ? (
            <span className="mt-1 block font-mono text-[0.6rem] text-slate-600">asOf {twinContextStrip.asOf}</span>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 text-xs text-amber-200/70">Nessun twin in memoria: solo spina e dati calendario grezzi.</p>
      )}
    </details>
  );
}
