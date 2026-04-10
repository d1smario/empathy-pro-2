"use client";

import { useCallback, useEffect, useState } from "react";
import { Pro2Button } from "@/components/ui/empathy";
import { fetchMultiscaleBottleneck } from "@/modules/physiology/services/multiscale-bottleneck-api";
import type { MultiscaleBottleneckApiOk } from "@/lib/knowledge/multiscale-bottleneck-contract";

type Props = {
  athleteId: string | null;
};

function formatPct01(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function MultiscaleBottleneckPanelPro2({ athleteId }: Props) {
  const [data, setData] = useState<MultiscaleBottleneckApiOk | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athleteId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetchMultiscaleBottleneck(athleteId, { includeSubgraph: true });
      setData(res);
    } catch (e) {
      setData(null);
      setErr(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!athleteId) {
    return (
      <p className="text-sm text-slate-500">
        Seleziona un atleta attivo per vedere la vista multiscala (interpretazione, non sostituisce i motori).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pro2Button
          type="button"
          variant="secondary"
          className="border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Aggiornamento…" : "Aggiorna da twin / lab"}
        </Pro2Button>
        {data ? (
          <span className="font-mono text-[0.65rem] text-slate-500">
            Ontologia {data.bottleneck.ontologyVersion}
          </span>
        ) : null}
      </div>

      {err ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{err}</div> : null}

      {!data && !loading && !err ? (
        <p className="text-sm text-slate-500">Nessun dato ancora caricato.</p>
      ) : null}

      {data ? (
        <>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div className="text-[0.65rem] font-semibold uppercase tracking-wide text-cyan-200/90">Collo dominante (L1–L6)</div>
            <div className="mt-1 text-lg font-bold text-slate-100">{data.dominantLevelLabelIt}</div>
            <div className="mt-2 text-sm text-slate-300">
              Peso interpretativo: <strong className="text-cyan-100">{formatPct01(data.bottleneck.dominantBottleneck.score)}</strong>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{data.bottleneck.dominantBottleneck.rationaleIt}</p>
          </div>

          <div>
            <div className="physiology-pro2-mini-banner mb-2">Ordine livelli (da vincolo maggiore)</div>
            <ul className="space-y-2">
              {data.bottleneck.orderedLevels.map((row) => (
                <li key={row.level} className="flex items-center gap-3 text-sm text-slate-300">
                  <span className="w-8 tabular-nums text-slate-500">L{row.level}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-fuchsia-500/70"
                      style={{ width: formatPct01(row.score) }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums text-slate-400">{formatPct01(row.score)}</span>
                </li>
              ))}
            </ul>
          </div>

          {data.bottleneck.suggestedInterpretationTags.length > 0 ? (
            <div>
              <div className="physiology-pro2-mini-banner mb-2">Tag interpretativi</div>
              <div className="flex flex-wrap gap-2">
                {data.bottleneck.suggestedInterpretationTags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/15 bg-black/30 px-2.5 py-0.5 font-mono text-[0.65rem] text-slate-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <details className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-slate-400">
            <summary className="cursor-pointer text-slate-300">Nodi ontologia attivati + sottografo</summary>
            <div className="mt-2 space-y-2 font-mono text-[0.65rem] leading-relaxed">
              <div>
                <span className="text-slate-500">IDs:</span> {data.bottleneck.activatedNodeIds.join(", ")}
              </div>
              {data.subgraph ? (
                <div>
                  Sottografo (1-hop): {data.subgraph.nodes.length} nodi, {data.subgraph.edges.length} archi.
                </div>
              ) : null}
              <div className="text-slate-500">
                Proxy ingresso: redox {data.snapshot.redoxStressIndex ?? "—"}, infiammazione{" "}
                {data.snapshot.twinInflammationRisk ?? "—"}, glicogeno {data.snapshot.glycogenStatus ?? "—"}, readiness{" "}
                {data.snapshot.readiness ?? "—"}, gut% {data.snapshot.gutStressScorePct ?? "—"}, CHO delivery%{" "}
                {data.snapshot.choDeliveryPctOfIngested ?? "—"}, ossidativo {data.snapshot.oxidativeBottleneckIndex ?? "—"}.
              </div>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
