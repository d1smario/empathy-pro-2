"use client";

import { useMemo } from "react";
import { AdaptationSectorStrip } from "@/components/nutrition/AdaptationSectorStrip";
import type { AdaptationSectorPillVm } from "@/lib/adaptation/adaptation-sector-box";
import type { SessionAnalysisFacetCategory } from "@/api/training/contracts";
import {
  buildSessionMultilevelAnalysisStrip,
  type Pro2SessionMultilevelSource,
} from "@/lib/training/session-multilevel-analysis-strip";
import { viewModelFromSessionInterpretation } from "@/lib/training/builder/pro2-session-interpretation";

function pillsForCategory(
  category: SessionAnalysisFacetCategory,
  facets: ReturnType<typeof buildSessionMultilevelAnalysisStrip>["facets"],
): AdaptationSectorPillVm[] {
  return facets
    .filter((f) => f.category === category)
    .slice(0, 3)
    .map((f) => ({
      id: f.id,
      text: f.pillLabelIt,
      direction:
        f.source === "load_proxy" || f.source === "session_knowledge"
          ? ("reverse" as const)
          : ("forward" as const),
    }));
}

/**
 * Striscia KPI multilivello **deterministica** (facet template): incrocio sessione ↔ domini fisiologici.
 * Non sostituisce il motore; esposizione strutturata + domande coach + facilitazioni.
 */
export function SessionMultilevelAnalysisStrip({
  contract,
  fallbackTss,
  fallbackDurationMin,
  compact = false,
}: {
  contract: Pro2SessionMultilevelSource | null | undefined;
  fallbackTss?: number | null;
  fallbackDurationMin?: number | null;
  compact?: boolean;
}) {
  const vm = useMemo(() => {
    const interp = contract?.sessionInterpretation;
    if (interp?.modelVersion === 1 && interp.sectors.length > 0) {
      return viewModelFromSessionInterpretation(interp);
    }
    return buildSessionMultilevelAnalysisStrip({ contract, fallbackTss, fallbackDurationMin });
  }, [contract, fallbackTss, fallbackDurationMin]);

  const boxes = useMemo(
    () => {
      const interp = contract?.sessionInterpretation;
      if (interp?.modelVersion === 1 && interp.sectors.length > 0) {
        return interp.sectors.map((s) => ({
          id: s.facetId,
          shortLabel: s.shortLabelIt,
          valueLine: s.valueLineIt,
          detailLine: s.detailHintIt,
          pills: s.pathwayPills?.map((p) => ({
            id: p.id,
            text: p.text,
            direction: p.direction,
          })),
        }));
      }
      return vm.stripSlots
        .filter((s) => s.valueLineIt !== "—")
        .map((s) => ({
          id: s.facetId,
          shortLabel: s.shortLabelIt,
          valueLine: s.valueLineIt,
          detailLine: s.detailHintIt,
          pills: pillsForCategory(s.category, vm.facets),
        }));
    },
    [contract?.sessionInterpretation, vm.stripSlots, vm.facets],
  );

  const activeCount = boxes.length;

  return (
    <div
      className={`rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/15 via-black/30 to-black/50 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-cyan-400/90">
          Analisi multilivello · deterministico
        </p>
        {activeCount > 0 ? (
          <span className="font-mono text-[0.6rem] text-slate-500">
            {activeCount} settori attivi · profilo blocchi + target
          </span>
        ) : null}
      </div>
      <AdaptationSectorStrip
        title="Settori · sessione · vie attivate"
        boxes={boxes}
        emptyHint={vm.notes[0] ?? "Nessun dato strutturato per questa seduta."}
      />

      {vm.coachPrompts.length > 0 ? (
        <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-950/20 px-3 py-2.5">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-violet-300/90">Domande coach</p>
          <ul className="mt-2 space-y-1.5">
            {vm.coachPrompts.map((q) => (
              <li key={q} className="text-xs leading-relaxed text-gray-300">
                <span className="mr-1.5 text-fuchsia-400/90" aria-hidden>
                  ?
                </span>
                {q}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {vm.facilitationHints.length > 0 ? (
        <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-950/15 px-3 py-2.5">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-300/90">
            Stimoli · facilitazioni
          </p>
          <ul className="mt-2 space-y-1.5">
            {vm.facilitationHints.map((h) => (
              <li key={h} className="text-[0.7rem] leading-relaxed text-gray-400">
                {h}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className={`rounded-lg border border-white/10 bg-black/30 px-3 py-2 ${compact ? "mt-3" : "mt-4"}`}>
        <summary className="cursor-pointer text-xs font-semibold text-gray-300">Note modello · elenco facet</summary>
        <ul className="mt-2 max-h-48 list-disc space-y-1.5 overflow-y-auto pl-4 text-[0.65rem] leading-relaxed text-gray-500">
          {vm.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
          {vm.facets.map((f) => (
            <li key={`all-${f.id}`}>
              <span className="font-semibold text-gray-400">{f.categoryLabelIt}</span> · {f.pillLabelIt} — {f.hintIt}
            </li>
          ))}
          {contract?.sessionInterpretation?.sectors.map((s) => (
            <li key={`sec-${s.facetId}`}>
              <span className="font-semibold text-gray-400">{s.shortLabelIt}</span> · {s.valueLineIt} — {s.detailHintIt}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
