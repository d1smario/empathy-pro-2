"use client";

import type { AdaptationSectorBoxVm } from "@/lib/adaptation/adaptation-sector-box";

const TONE_BORDER = ["border-slate-500/30", "border-amber-500/35", "border-cyan-500/35", "border-emerald-500/35", "border-rose-500/35"] as const;

export type { AdaptationSectorBoxVm } from "@/lib/adaptation/adaptation-sector-box";

export function AdaptationSectorStrip({
  boxes,
  title,
  emptyHint,
  className,
}: {
  boxes: AdaptationSectorBoxVm[];
  title?: string;
  emptyHint?: string;
  className?: string;
}) {
  if (!boxes.length) {
    return <p className={`text-xs text-slate-500 ${className ?? ""}`.trim()}>{emptyHint ?? "Nessun settore disponibile."}</p>;
  }

  return (
    <div className={`grid gap-2 ${className ?? ""}`.trim()}>
      {title ? <div className="text-sm font-bold tracking-wide text-slate-200">{title}</div> : null}
      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
        {boxes.map((b, i) => {
          const bdr = TONE_BORDER[i % TONE_BORDER.length];
          return (
            <div
              key={b.id}
              className={`shrink-0 rounded-xl border bg-black/30 px-2.5 py-2 ${bdr}`}
              style={{ minWidth: 104, maxWidth: 148 }}
            >
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">{b.shortLabel}</div>
              <div className="mt-1 text-sm font-bold tabular-nums text-white">{b.valueLine}</div>
              {b.pills?.length ? (
                <div className="mt-1.5 flex flex-col gap-1" aria-label="Sintesi effetto e contesto">
                  {b.pills.map((p) => (
                    <span
                      key={p.id}
                      title={
                        p.direction === "forward"
                          ? "Effetto dello stimolo / della seduta sulla via (modello deterministico)."
                          : "Contesto atleta (recovery, lab, dieta) che modula la via o le scelte alimentari."
                      }
                      className={`rounded-md px-1.5 py-0.5 font-mono text-[0.58rem] leading-tight ${
                        p.direction === "forward"
                          ? "border border-cyan-500/35 bg-cyan-500/10 text-cyan-100/95"
                          : "border border-amber-500/35 bg-amber-500/10 text-amber-100/95"
                      }`}
                    >
                      <span className="opacity-70">{p.direction === "forward" ? "→ " : "← "}</span>
                      {p.text}
                    </span>
                  ))}
                </div>
              ) : null}
              <details className="mt-1">
                <summary className="cursor-pointer text-[0.6rem] text-slate-500">dettaglio</summary>
                <p className="mt-1 text-[0.65rem] leading-snug text-slate-400">{b.detailLine}</p>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
}
