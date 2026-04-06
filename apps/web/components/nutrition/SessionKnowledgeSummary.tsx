"use client";

import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

/**
 * Pro 2: il contratto builder in notes non include ancora `sessionKnowledge` serializzato come V1.
 * Mostra comunque discipline / adaptation target per contesto in seduta.
 */
export function SessionKnowledgeSummary({
  contract,
  compact = false,
}: {
  contract: Pro2BuilderSessionContract | null | undefined;
  compact?: boolean;
}) {
  if (!contract) return null;

  const parts = [contract.discipline, contract.sessionName].filter(Boolean);
  const target = contract.adaptationTarget?.trim();
  if (!parts.length && !target) return null;

  return (
    <div
      className={`grid gap-2 rounded-xl border border-violet-500/25 bg-violet-500/[0.08] ${
        compact ? "p-2.5" : "p-3.5"
      }`}
    >
      <div className="font-semibold text-violet-100">Sessione builder</div>
      {parts.length ? <div className="text-sm text-slate-300">{parts.join(" · ")}</div> : null}
      {target ? (
        <div className="text-xs text-slate-400">
          Target adattamento · <span className="text-slate-200">{target}</span>
        </div>
      ) : null}
    </div>
  );
}
