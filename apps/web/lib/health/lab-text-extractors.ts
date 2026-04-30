import "server-only";
import { EPIGENETIC_GENE_BANK, HEALTH_MARKERS, MICROBIOTA_TAXA } from "@/lib/health/health-ontology";

function parseEuNumber(raw: string): number | null {
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (n <= 0 || n > 1e7) return null;
  return n;
}

/** Cerca la prima occorrenza di una label e un numero entro `window` caratteri. */
function numberAfterLabels(text: string, labels: string[], window = 140): number | null {
  const norm = text.replace(/\r\n/g, "\n");
  const lower = norm.toLowerCase();
  for (const label of labels) {
    const L = label.toLowerCase();
    let from = 0;
    for (;;) {
      const i = lower.indexOf(L, from);
      if (i < 0) break;
      const slice = norm.slice(i, i + window);
      const m = slice.match(/(\d+[.,]\d+|\d{2,})/);
      if (m) {
        const v = parseEuNumber(m[1]);
        if (v != null) return v;
      }
      from = i + L.length;
    }
  }
  return null;
}

export type HealthPanelTypeForParse =
  | "blood"
  | "microbiota"
  | "epigenetics"
  | "hormones"
  | "inflammation"
  | "oxidative_stress";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectGeneHits(text: string): string[] {
  const upper = text.toUpperCase();
  const hits: string[] = [];
  for (const gene of EPIGENETIC_GENE_BANK) {
    const rx = new RegExp(`\\b${escapeRegExp(gene)}\\b`, "i");
    if (rx.test(upper)) hits.push(gene);
  }
  return Array.from(new Set(hits));
}

/**
 * Estrae numeri da testo laboratorio (IT/EN) in chiavi compatibili con i grafici Health.
 * Euristica: nessuna garanzia clinica; serve a pre-compilare `values` per trend/radar.
 */
export function extractStructuredValuesFromLabText(
  rawText: string,
  panelType: HealthPanelTypeForParse,
): Record<string, unknown> {
  const text = rawText.replace(/\u00a0/g, " ");
  const out: Record<string, unknown> = {};

  const set = (key: string, v: number | null) => {
    if (v == null) return;
    if (out[key] == null) out[key] = Number(v);
  };

  for (const marker of HEALTH_MARKERS.filter((m) => m.panelType === panelType)) {
    set(marker.key, numberAfterLabels(text, marker.aliases));
  }

  if (panelType === "microbiota") {
    const taxaRows = MICROBIOTA_TAXA.map((t) => {
      const pct = numberAfterLabels(text, t.aliases);
      if (pct == null) return null;
      return { key: t.key, label: t.label, pct: Number(pct), rank: t.rank, kind: t.kind };
    }).filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (taxaRows.length) out.microbiota_taxa = taxaRows;
    if (taxaRows.some((r) => r.kind === "fungi")) out.microbiota_fungi_present = 1;
    set("diversity_shannon", numberAfterLabels(text, ["shannon", "diversità", "diversity alpha", "alpha diversity"]));
    set("scfa_total_mmol", numberAfterLabels(text, ["scfa", "acidi grassi a catena corta", "short chain fatty"]));
    return out;
  }

  if (panelType === "epigenetics") {
    const hits = collectGeneHits(text);
    if (hits.length) out.epigenetic_gene_hits = hits;
    const methylationKeywords = ["ipermetil", "hypermethyl", "hypomethyl", "ipometil", "methylation"];
    const foundKeywords = methylationKeywords.filter((k) => text.toLowerCase().includes(k));
    if (foundKeywords.length) out.epigenetic_methylation_flags = foundKeywords;
    return out;
  }

  return out;
}
