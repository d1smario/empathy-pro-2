"use client";

import { useMemo } from "react";
import { Pro2GymSchedaBlockList } from "@/components/training/Pro2GymSchedaBlockList";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import { SessionMultilevelAnalysisStrip } from "@/components/training/SessionMultilevelAnalysisStrip";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { ensurePro2BuilderSessionInterpretation } from "@/lib/training/builder/pro2-session-interpretation";
import {
  effectiveDurationMinutesFromPro2Contract,
  estimatedTssFromPro2Contract,
  pro2BuilderContractToChartSegments,
} from "@/lib/training/builder/pro2-session-notes";
import { contractHasGymScheda } from "@/lib/training/planned-workout-display";

export function CoachLibraryContractPreview({
  contract,
  title,
  tssFallback,
  durationFallback,
  compact = true,
}: {
  contract: Pro2BuilderSessionContract;
  title?: string;
  tssFallback?: number;
  durationFallback?: number;
  compact?: boolean;
}) {
  const enriched = useMemo(
    () =>
      ensurePro2BuilderSessionInterpretation(contract, {
        tss: tssFallback,
        durationMin: durationFallback,
      }),
    [contract, tssFallback, durationFallback],
  );

  const segments = useMemo(() => pro2BuilderContractToChartSegments(enriched), [enriched]);
  const tssEst = useMemo(() => {
    const fromContract = estimatedTssFromPro2Contract(enriched);
    if (fromContract > 0) return fromContract;
    return typeof tssFallback === "number" && tssFallback > 0 ? Math.round(tssFallback) : undefined;
  }, [enriched, tssFallback]);
  const durationMin = useMemo(
    () => effectiveDurationMinutesFromPro2Contract(enriched, durationFallback ?? 60),
    [enriched, durationFallback],
  );

  const gymScheda = contractHasGymScheda(enriched);
  const chartTitle = title ? `Struttura · ${title}` : "Struttura seduta";

  if (enriched.family === "strength") {
    return (
      <div className="space-y-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fuchsia-200/90">Scheda palestra</p>
        <Pro2GymSchedaBlockList contract={enriched} />
        {!gymScheda && segments.length > 0 ? (
          <SessionBlockIntensityChart
            segments={segments}
            title="Proxy tempo / carico"
            estimatedTss={tssEst}
            compact={compact}
          />
        ) : null}
        {!gymScheda && segments.length === 0 ? (
          <p className="text-xs text-slate-500">Nessun esercizio in scheda — apri nel Builder per completare.</p>
        ) : null}
        <SessionMultilevelAnalysisStrip
          contract={enriched}
          fallbackTss={tssEst ?? tssFallback}
          fallbackDurationMin={durationMin}
          compact
        />
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="space-y-3">
        <p className="rounded-xl border border-white/10 bg-black/40 px-3 py-6 text-center text-xs text-slate-500">
          Nessun blocco da visualizzare in questo template.
        </p>
        <SessionMultilevelAnalysisStrip
          contract={enriched}
          fallbackTss={tssFallback}
          fallbackDurationMin={durationFallback}
          compact
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SessionBlockIntensityChart
        segments={segments}
        title={chartTitle}
        estimatedTss={tssEst}
        compact={compact}
      />
      <SessionMultilevelAnalysisStrip
        contract={enriched}
        fallbackTss={tssEst ?? tssFallback}
        fallbackDurationMin={durationMin}
        compact
      />
    </div>
  );
}
