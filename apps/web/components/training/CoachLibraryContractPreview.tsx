"use client";

import { useMemo } from "react";
import { Pro2GymSchedaBlockList } from "@/components/training/Pro2GymSchedaBlockList";
import { SessionBlockIntensityChart } from "@/components/training/SessionBlockIntensityChart";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import {
  estimatedTssFromPro2Contract,
  pro2BuilderContractToChartSegments,
} from "@/lib/training/builder/pro2-session-notes";
import { contractHasGymScheda } from "@/lib/training/planned-workout-display";

export function CoachLibraryContractPreview({
  contract,
  title,
  tssFallback,
  compact = true,
}: {
  contract: Pro2BuilderSessionContract;
  title?: string;
  tssFallback?: number;
  compact?: boolean;
}) {
  const segments = useMemo(() => pro2BuilderContractToChartSegments(contract), [contract]);
  const tssEst = useMemo(() => {
    const fromContract = estimatedTssFromPro2Contract(contract);
    if (fromContract > 0) return fromContract;
    return typeof tssFallback === "number" && tssFallback > 0 ? Math.round(tssFallback) : undefined;
  }, [contract, tssFallback]);

  const gymScheda = contractHasGymScheda(contract);
  const chartTitle = title ? `Struttura · ${title}` : "Struttura seduta";

  if (contract.family === "strength") {
    return (
      <div className="space-y-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-fuchsia-200/90">Scheda palestra</p>
        <Pro2GymSchedaBlockList contract={contract} />
        {!gymScheda && segments.length > 0 ? (
          <SessionBlockIntensityChart
            segments={segments}
            title="Proxy tempo / carico"
            estimatedTss={tssEst}
          />
        ) : null}
        {!gymScheda && segments.length === 0 ? (
          <p className="text-xs text-slate-500">Nessun esercizio in scheda — apri nel Builder per completare.</p>
        ) : null}
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-black/40 px-3 py-6 text-center text-xs text-slate-500">
        Nessun blocco da visualizzare in questo template.
      </p>
    );
  }

  return (
    <SessionBlockIntensityChart
      segments={segments}
      title={chartTitle}
      estimatedTss={tssEst}
      compact={compact}
    />
  );
}
