"use client";

import type { PlannedWorkout } from "@empathy/domain-training";
import { BuilderPlannedSessionViz } from "@/components/training/BuilderPlannedSessionViz";
import { SessionMultilevelAnalysisStrip } from "@/components/training/SessionMultilevelAnalysisStrip";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { GymExerciseMediaThumb } from "@/components/training/GymExerciseMediaThumb";
import { LifestylePracticeMediaThumb } from "@/components/training/LifestylePracticeMediaThumb";
import { Pro2Link } from "@/components/ui/empathy";
import {
  estimatedTssFromPro2Contract,
  parsePro2BuilderSessionFromNotes,
  pro2BuilderContractToChartSegments,
} from "@/lib/training/builder/pro2-session-notes";
import type { LifestylePracticeCategory } from "@/lib/training/builder/lifestyle-playbook-catalog";

const LIFESTYLE_CATS: readonly LifestylePracticeCategory[] = [
  "yoga",
  "pilates",
  "breath",
  "meditation",
  "mobility",
  "stretch",
];

function asLifestyleCategory(raw: string | undefined): LifestylePracticeCategory {
  if (raw && (LIFESTYLE_CATS as readonly string[]).includes(raw)) return raw as LifestylePracticeCategory;
  return "mobility";
}
import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

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

export function CalendarPlannedBuilderDetail({ workout }: { workout: PlannedWorkout }) {
  const [structureOpen, setStructureOpen] = useState(true);
  const contract = useMemo(() => parsePro2BuilderSessionFromNotes(workout.notes ?? null), [workout.notes]);

  const segments = useMemo(() => (contract ? pro2BuilderContractToChartSegments(contract) : []), [contract]);

  const tssEst = useMemo(() => (contract ? estimatedTssFromPro2Contract(contract) : 0), [contract]);

  const sessionHref = `/training/session/${workout.date}`;
  const builderHref = `/training/builder?date=${encodeURIComponent(workout.date)}&replace_planned_id=${encodeURIComponent(workout.id)}`;

  const family = contract?.family;

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
            <span className="font-mono text-xs text-gray-500">{workout.type}</span>
          </div>
          <h4 className="mt-1.5 text-base font-bold text-white">
            {contract?.sessionName?.trim() || workout.type} · {workout.durationMinutes}′ · TSS {workout.tssTarget}
          </h4>
          {contract?.discipline ? (
            <p className="mt-0.5 text-xs text-gray-500">
              {contract.discipline}
              {contract.adaptationTarget ? ` · ${contract.adaptationTarget}` : ""}
              {contract.phase ? ` · fase ${contract.phase}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Pro2Link href={sessionHref} variant="ghost" className="border border-orange-500/35 bg-orange-500/10 text-xs">
            Giornata
            <ExternalLink className="ml-1 inline h-3 w-3 opacity-70" aria-hidden />
          </Pro2Link>
          <Pro2Link href={builderHref} variant="ghost" className="border border-fuchsia-500/35 bg-fuchsia-500/10 text-xs">
            Builder
          </Pro2Link>
        </div>
      </div>

      {!contract ? (
        <p className="mt-3 text-sm text-gray-500">
          Nessun payload <code className="text-gray-600">BUILDER_SESSION_JSON</code> in notes: seduta manuale legacy o creata fuori
          builder.
        </p>
      ) : (
        <details
          className="mt-4 rounded-xl border border-white/10 bg-black/25"
          open={structureOpen}
          onToggle={(e) => setStructureOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-gray-200 marker:hidden [&::-webkit-details-marker]:hidden">
            Struttura · apri / chiudi
          </summary>
          <div className="space-y-4 border-t border-white/10 px-3 pb-4 pt-3">
            {family === "aerobic" && segments.length > 0 ? (
              <SessionBlockIntensityChart
                segments={segments}
                title="Grafico a blocchi (pianificato)"
                estimatedTss={tssEst > 0 ? tssEst : undefined}
              />
            ) : null}

            {(family === "strength" || family === "technical" || family === "lifestyle") && segments.length > 0 ? (
              <SessionBlockIntensityChart
                segments={segments}
                title="Proxy tempo / carico (stima)"
                estimatedTss={tssEst > 0 ? tssEst : undefined}
              />
            ) : null}

            <BuilderPlannedSessionViz contract={contract} title="Profilo zone (builder V1)" compact />

            <SessionMultilevelAnalysisStrip
              contract={contract}
              fallbackTss={workout.tssTarget}
              fallbackDurationMin={workout.durationMinutes}
              compact
            />

            <ul className="flex flex-col gap-3">
              {(contract.blocks ?? []).map((block, idx) => (
                <li
                  key={block.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-200"
                >
                  <div className="flex flex-wrap gap-3">
                    {family === "strength" && block.gymRx?.catalogExerciseId ? (
                      <GymExerciseMediaThumb
                        catalogExerciseId={block.gymRx.catalogExerciseId}
                        alt={block.label}
                        fallbackLabel={block.label}
                        className="h-20 w-20 shrink-0 rounded-lg border border-fuchsia-500/25 object-cover"
                      />
                    ) : null}
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
                      {block.gymRx ? (
                        <p className="mt-2 font-mono text-xs text-orange-200/90">
                          {block.gymRx.sets != null ? `${block.gymRx.sets}×` : ""}
                          {block.gymRx.reps ? `${block.gymRx.reps}` : "—"}
                          {block.gymRx.weightKg != null && block.gymRx.weightKg > 0 ? ` · ${block.gymRx.weightKg} kg` : ""}
                          {block.gymRx.executionStyle ? ` · ${block.gymRx.executionStyle}` : ""}
                        </p>
                      ) : null}
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
          </div>
        </details>
      )}
    </article>
  );
}
