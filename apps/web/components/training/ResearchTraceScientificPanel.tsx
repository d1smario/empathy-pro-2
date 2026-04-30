"use client";

import { useCallback, useEffect, useState } from "react";
import type { KnowledgeExpansionTrace, ResearchHopTrace, ResearchIntent } from "@/lib/empathy/schemas";
import { fetchKnowledgeResearchTracesExpanded } from "@/lib/knowledge/knowledge-research-traces-client";

type ResearchTraceScientificPanelProps = {
  athleteId: string | null | undefined;
  limit?: number;
  /** @deprecated riservato per layout compatto futuro; attualmente ignorato */
  compact?: boolean;
  className?: string;
  /**
   * `multi`: una griglia 4 settori per ogni traccia (utile dove serve confronto).
   * `latest_primary`: una sola griglia canonica sulla traccia più recente; le altre in cronologia collassata (builder training).
   */
  traceSurface?: "multi" | "latest_primary";
};

const HOP_SECTOR: Record<
  ResearchHopTrace["kind"],
  { shortTitle: string; physiologyFunction: string; amplificationFocus: string }
> = {
  literature_search: {
    shortTitle: "Stimolo & sistemi",
    physiologyFunction: "Risposta acuta e cronica al carico; neuro‑endocrino e integrazione sistemica",
    amplificationFocus: "Fenotipi, ormoni, stress termico/metabolico in letteratura",
  },
  entity_lookup: {
    shortTitle: "Segnale & geni",
    physiologyFunction: "Trasduzione, fattori di trascrizione, ormoni e recettori",
    amplificationFocus: "Geni · proteine · vie di segnale (Reactome/GO/Uniprot)",
  },
  pathway_lookup: {
    shortTitle: "Pathway",
    physiologyFunction: "Processi di rete (via metabolica / segnale)",
    amplificationFocus: "Pathway curati e relazioni causali tra processi",
  },
  reaction_lookup: {
    shortTitle: "Metabolismo & cofattori",
    physiologyFunction: "Flussi substrati, enzimi, cofattori, micronutrienti",
    amplificationFocus: "Metaboliti · reazioni · modulatori (HMDB/ChEBI/KEGG)",
  },
  projection_review: {
    shortTitle: "Proiezione moduli",
    physiologyFunction: "Traduzione in training, nutrizione, recovery, salute",
    amplificationFocus: "Implicazioni operative cross‑modulo (audit, non decisione automatica)",
  },
};

const HOP_ORDER = ["hop-literature", "hop-mechanisms", "hop-reactions", "hop-projection"];

function intentForHop(trace: KnowledgeExpansionTrace, hop: ResearchHopTrace): ResearchIntent | null {
  return trace.intents.find((i) => i.intentId === hop.intentId) ?? null;
}

function traceFocus(trace: KnowledgeExpansionTrace) {
  return (
    trace.trigger.stimulusLabel ??
    trace.trigger.entityLabel ??
    trace.trigger.adaptationTarget?.replaceAll("_", " ") ??
    "stimolo"
  );
}

function humanizeEntityTypes(types: string[]): string {
  if (!types.length) return "—";
  return types
    .slice(0, 5)
    .map((t) => t.replaceAll("_", " "))
    .join(" · ");
}

function sortHops(hops: ResearchHopTrace[]): ResearchHopTrace[] {
  return [...hops].sort((a, b) => {
    const ia = HOP_ORDER.indexOf(a.hopId);
    const ib = HOP_ORDER.indexOf(b.hopId);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function traceSubtitle(trace: KnowledgeExpansionTrace) {
  return (
    <>
      Modulo {trace.trigger.module ?? "—"} · {trace.trigger.kind}
      {trace.trigger.adaptationTarget ? ` · adattamento ${trace.trigger.adaptationTarget.replaceAll("_", " ")}` : ""}
    </>
  );
}

export function ResearchTraceScientificPanel({
  athleteId,
  limit = 8,
  className,
  traceSurface = "multi",
}: ResearchTraceScientificPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [traces, setTraces] = useState<KnowledgeExpansionTrace[]>([]);

  const load = useCallback(async () => {
    if (!athleteId?.trim()) {
      setTraces([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchKnowledgeResearchTracesExpanded(athleteId.trim(), { limit });
      if (res.error) setError(res.error);
      setTraces(res.expansionTraces ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caricamento tracce fallito");
      setTraces([]);
    } finally {
      setLoading(false);
    }
  }, [athleteId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!athleteId?.trim()) return null;

  return (
    <div
      className={`rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/20 via-black/40 to-black/60 p-4 sm:p-5 ${className ?? ""}`}
    >
      <h3 className="text-base font-bold text-white">Traccia scientifica canonica</h3>
      <p className="mt-1 text-[0.7rem] leading-snug text-gray-500">
        Audit tra motori deterministici e corpus evidenze; non sostituisce la decisione fisiologica del motore (regole Pro 2).
      </p>

      {loading && <p className="mt-3 text-xs text-gray-500">Caricamento tracce…</p>}
      {error && <p className="mt-3 text-xs text-rose-300/90">{error}</p>}
      {!loading && !traces.length && !error && (
        <p className="mt-3 text-xs text-gray-500">Nessuna traccia: genera da VIRYA / builder o salva un piano di ricerca.</p>
      )}

      {(() => {
        const gridTraces = traceSurface === "latest_primary" && traces.length ? [traces[0]] : traces;
        const historyTraces = traceSurface === "latest_primary" && traces.length > 1 ? traces.slice(1) : [];

        return (
          <>
            {gridTraces.map((trace, ti) => {
              const hops = sortHops(trace.hops);
              return (
                <div
                  key={trace.traceId}
                  className={ti > 0 ? "mt-4 border-t border-white/10 pt-4" : "mt-3"}
                >
                  <p className="text-sm font-semibold text-gray-200">Focus · {traceFocus(trace)}</p>
                  <p className="mt-0.5 text-[0.65rem] text-gray-500">{traceSubtitle(trace)}</p>

                  <div className="builder-kpi-grid mt-3">
                    {hops.map((hop, idx) => {
                      const sector = HOP_SECTOR[hop.kind] ?? {
                        shortTitle: hop.kind,
                        physiologyFunction: "Espansione knowledge",
                        amplificationFocus: hop.kind,
                      };
                      const intent = intentForHop(trace, hop);
                      const docN = hop.linkedDocumentIds?.length ?? 0;
                      const asN = hop.linkedAssertionIds?.length ?? 0;
                      const fnLabel = intent?.label ?? sector.physiologyFunction;
                      return (
                        <div key={hop.traceHopId} className="builder-kpi-card min-h-[7rem] text-left">
                          <div className="kpi-card-label flex items-start gap-2 text-left leading-tight">
                            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
                            <span>
                              {idx + 1}. {sector.shortTitle}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-semibold leading-snug text-gray-100">{fnLabel}</p>
                          <p className="mt-2 text-[0.65rem] leading-snug text-gray-400">
                            Amplifichiamo: {sector.amplificationFocus}
                          </p>
                          <p className="mt-2 text-[0.6rem] text-gray-500">
                            Entità: {humanizeEntityTypes(hop.expectedEntityTypes)} · {docN} doc · {asN} ass · {hop.status}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {historyTraces.length > 0 ? (
              <details className="mt-4 rounded-xl border border-violet-500/20 bg-violet-950/10 px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-violet-200/90">
                  Cronologia tracce salvate ({historyTraces.length}) — stessa struttura a 4 settori, senza ripetere la griglia
                </summary>
                <ul className="mt-2 space-y-2 border-t border-white/10 pt-2 text-[0.65rem] leading-snug text-gray-400">
                  {historyTraces.map((t) => (
                    <li key={`hist-${t.traceId}`} className="rounded-lg border border-white/5 bg-black/20 px-2.5 py-2">
                      <span className="font-mono text-[0.58rem] text-gray-500">{t.createdAt}</span>
                      <span className="mt-0.5 block font-semibold text-gray-300">Focus · {traceFocus(t)}</span>
                      <span className="mt-0.5 block text-gray-500">{traceSubtitle(t)}</span>
                      <span className="mt-0.5 block text-gray-600">
                        {t.hops.length} hop · {t.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        );
      })()}

      <details className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-gray-200">Approfondimento testuale (audit)</summary>
        <div className="mt-3 space-y-3 text-xs leading-relaxed text-gray-400">
          <p>
            <strong className="text-gray-300">Obiettivo operativo:</strong> collegare training e stato fisiologico/twin calcolato
            dai motori alle evidenze persistite (documenti + assertion). Auditabilità, non LLM che decide la fisiologia.
          </p>
          {traces.map((trace) => (
            <div key={`txt-${trace.traceId}`}>
              <p className="font-semibold text-gray-300">{traceFocus(trace)}</p>
              {sortHops(trace.hops).map((hop) => {
                const sector = HOP_SECTOR[hop.kind];
                const intent = intentForHop(trace, hop);
                return (
                  <div
                    key={hop.traceHopId}
                    className="mt-2 rounded-lg border border-white/10 bg-black/25 p-2.5"
                  >
                    <p className="font-semibold text-gray-300">
                      {sector?.shortTitle ?? hop.kind} — {intent?.label ?? sector?.physiologyFunction}
                    </p>
                    <p className="mt-1">
                      <strong>Perché:</strong> {intent?.rationale ?? sector?.physiologyFunction}
                    </p>
                    <p className="mt-1">
                      <strong>Domanda operativa:</strong> {hop.question}
                    </p>
                    <p className="mt-1 text-[0.65rem] opacity-90">
                      Fonti previste: {hop.sourceDbs.join(", ") || "—"} · esito: {hop.resultSummary ?? "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          ))}
          {!traces.length && !loading ? <p>Nessun contenuto finché non esistono tracce salvate.</p> : null}
        </div>
      </details>
    </div>
  );
}
