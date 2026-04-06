"use client";

import { useMemo } from "react";
import { AdaptationSectorStrip } from "@/components/nutrition/AdaptationSectorStrip";
import {
  buildSessionMultilevelAnalysisStrip,
  type Pro2SessionMultilevelSource,
} from "@/lib/training/session-multilevel-analysis-strip";

/**
 * Striscia KPI multilivello **deterministica** (facet template): incrocio sessione ↔ domini fisiologici.
 * Non sostituisce il motore; solo esposizione strutturata (regole generative Pro 2).
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
  const vm = useMemo(
    () => buildSessionMultilevelAnalysisStrip({ contract, fallbackTss, fallbackDurationMin }),
    [contract, fallbackTss, fallbackDurationMin],
  );

  const boxes = useMemo(
    () =>
      vm.stripSlots.map((s) => ({
        id: s.facetId,
        shortLabel: s.shortLabelIt,
        valueLine: s.valueLineIt,
        detailLine: s.detailHintIt,
      })),
    [vm.stripSlots],
  );

  return (
    <div
      className={`rounded-xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/15 via-black/30 to-black/50 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <p className="mb-2 font-mono text-[0.6rem] font-bold uppercase tracking-wider text-cyan-400/90">
        Analisi multilivello · deterministico
      </p>
      <AdaptationSectorStrip
        title="Settori · sessione"
        boxes={boxes}
        emptyHint={vm.notes[0] ?? "Nessun dato."}
      />
      {!compact ? (
        <details className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
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
          </ul>
        </details>
      ) : null}
    </div>
  );
}
