import "server-only";
import { EPIGENETIC_GENE_BANK, HEALTH_MARKERS, MICROBIOTA_TAXA } from "@/lib/health/health-ontology";

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function parseEuNumber(raw: string): number | null {
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  if (n <= 0 || n > 1e7) return null;
  return n;
}

/** Evita di interpretare anni (2024–2030) come valori di laboratorio quando sono interi a 4 cifre. */
function isLikelyYearInteger(token: string, value: number): boolean {
  if (/[.,]/.test(token)) return false;
  const int = Math.round(value);
  return int >= 1900 && int <= 2100;
}

/**
 * Primo numero plausibile dopo la label nella finestra di testo (decimali EU e interi 2–6 cifre;
 * opzionale 1–9 per GR/WBC molto bassi).
 */
function firstNumericInSlice(slice: string, opts?: { allowSingleDigit?: boolean }): number | null {
  const candidates: Array<{ raw: string; v: number }> = [];
  const reDecimalOrMulti = /\d+[.,]\d+|\d{2,6}/g;
  let m: RegExpExecArray | null;
  while ((m = reDecimalOrMulti.exec(slice)) !== null) {
    const v = parseEuNumber(m[0]);
    if (v != null && !isLikelyYearInteger(m[0], v)) candidates.push({ raw: m[0], v });
  }
  if (opts?.allowSingleDigit) {
    const reSingle = /\b([1-9])\b/g;
    while ((m = reSingle.exec(slice)) !== null) {
      const v = parseEuNumber(m[1]);
      if (v != null) candidates.push({ raw: m[1], v });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => slice.indexOf(a.raw) - slice.indexOf(b.raw));
  return candidates[0]?.v ?? null;
}

/** Cerca la prima occorrenza di una label e un numero entro `window` caratteri. */
function numberAfterLabels(
  rawText: string,
  labels: string[],
  window = 200,
  opts?: { allowSingleDigit?: boolean },
): number | null {
  const norm = stripDiacritics(rawText.replace(/\u00a0/g, " ")).replace(/\r\n/g, "\n");
  const lower = norm.toLowerCase();
  const sorted = [...labels].sort((a, b) => stripDiacritics(b).length - stripDiacritics(a).length);
  for (const label of sorted) {
    const L = stripDiacritics(label).toLowerCase();
    if (!L.trim()) continue;
    let from = 0;
    for (;;) {
      const i = lower.indexOf(L, from);
      if (i < 0) break;
      const slice = norm.slice(i, i + window);
      const v = firstNumericInSlice(slice, opts);
      if (v != null) return v;
      from = i + Math.max(1, L.length);
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

/** Alcuni referti riportano WBC/RBC a una sola cifra prima dell’unità. */
const BLOOD_SINGLE_DIGIT_KEYS = new Set(["rbc", "wbc"]);

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
    const allowSingle = panelType === "blood" && BLOOD_SINGLE_DIGIT_KEYS.has(marker.key);
    const aliasesSorted = [...marker.aliases].sort(
      (a, b) => stripDiacritics(b).length - stripDiacritics(a).length,
    );
    set(marker.key, numberAfterLabels(text, aliasesSorted, 220, { allowSingleDigit: allowSingle }));
  }

  if (panelType === "microbiota") {
    const taxaRows = MICROBIOTA_TAXA.map((t) => {
      const aliasesSorted = [...t.aliases].sort(
        (a, b) => stripDiacritics(b).length - stripDiacritics(a).length,
      );
      const pct = numberAfterLabels(text, aliasesSorted, 240);
      if (pct == null) return null;
      return { key: t.key, label: t.label, pct: Number(pct), rank: t.rank, kind: t.kind };
    }).filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (taxaRows.length) {
      out.microbiota_taxa = taxaRows;
      for (const row of taxaRows) {
        const k = row.key;
        out[`${k}_pct`] = row.pct;
        out[k] = row.pct;
      }
    }
    if (taxaRows.some((r) => r.kind === "fungi")) out.microbiota_fungi_present = 1;
    set(
      "diversity_shannon",
      numberAfterLabels(text, [
        "indice di shannon",
        "indice shannon",
        "shannon diversity",
        "shannon index",
        "shannon",
        "diversità alfa",
        "diversità α",
        "alpha diversity",
        "diversity alpha",
        "diversità",
      ]),
    );
    set(
      "scfa_total_mmol",
      numberAfterLabels(text, [
        "acidi grassi a catena corta totali",
        "acidi grassi a catena corta",
        "short chain fatty acids",
        "short chain fatty",
        "scfa totali",
        "scfa",
      ]),
    );
    return out;
  }

  if (panelType === "epigenetics") {
    const hits = collectGeneHits(text);
    if (hits.length) out.epigenetic_gene_hits = hits;
    const methylationKeywords = ["ipermetil", "hypermethyl", "hypomethyl", "ipometil", "methylation"];
    const foundKeywords = methylationKeywords.filter((k) => stripDiacritics(text).toLowerCase().includes(k));
    if (foundKeywords.length) out.epigenetic_methylation_flags = foundKeywords;
    return out;
  }

  return out;
}
