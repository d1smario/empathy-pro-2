import type {
  BioenergeticMetricTile,
  BioenergeticMetricTileCategory,
  BioenergeticPathwayImpact,
  BioenergeticsDayViewModel,
} from "@/api/bioenergetics/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import {
  buildMonitoringChannelsFromStripAiParse,
  buildOpenAiStripRealityCompact,
  parseStripAiOpenAiContent,
  shouldSkipGlucosePredictor,
} from "@/lib/bioenergetics/bioenergetic-continuous-strip-ai-inputs";

/** Catalogo tile mostrate in UI (allineato alle categorie prodotto + screenshot). */
export type BioenergeticGenerativeTileSpec = {
  id: string;
  labelIt: string;
  unit: string;
  category: BioenergeticMetricTileCategory;
  impact: BioenergeticPathwayImpact;
};

export const BIOENERGETIC_GENERATIVE_TILE_PANEL: readonly BioenergeticGenerativeTileSpec[] = [
  { id: "glucose", labelIt: "Glucosio", unit: "mmol/L", category: "metabolic", impact: "neutral" },
  { id: "lactate", labelIt: "Lattato", unit: "mmol/L", category: "metabolic", impact: "neutral" },
  { id: "insulin_proxy", labelIt: "Domanda insulinica (proxy)", unit: "score 0–100", category: "metabolic", impact: "neutral" },
  { id: "homa_ir", labelIt: "HOMA-IR", unit: "indice", category: "metabolic", impact: "neutral" },
  { id: "insulin_lab", labelIt: "Insulina (lab)", unit: "µUI/mL", category: "metabolic", impact: "neutral" },
  { id: "crp", labelIt: "PCR-us (contesto)", unit: "mg/L", category: "inflammatory", impact: "neutral" },
  { id: "testosterone", labelIt: "Testosterone", unit: "ng/dL", category: "hormonal", impact: "neutral" },
  { id: "free_testosterone", labelIt: "Testosterone libero", unit: "pg/mL", category: "hormonal", impact: "neutral" },
  { id: "tsh", labelIt: "TSH", unit: "mUI/L", category: "hormonal", impact: "neutral" },
  { id: "ft3", labelIt: "T3 / FT3", unit: "pg/mL", category: "hormonal", impact: "neutral" },
  { id: "ft4", labelIt: "T4 libera / T4", unit: "ng/dL", category: "hormonal", impact: "neutral" },
  { id: "cortisol", labelIt: "Cortisolo", unit: "µg/dL", category: "hormonal", impact: "neutral" },
  { id: "acth", labelIt: "ACTH", unit: "pg/mL", category: "hormonal", impact: "neutral" },
  { id: "gh", labelIt: "GH", unit: "ng/mL", category: "hormonal", impact: "neutral" },
  { id: "igf1", labelIt: "IGF-1", unit: "ng/mL", category: "hormonal", impact: "neutral" },
  { id: "dhea", labelIt: "DHEA-S / DHEA", unit: "µg/dL", category: "hormonal", impact: "neutral" },
  { id: "progesterone", labelIt: "Progesterone", unit: "ng/mL", category: "hormonal", impact: "neutral" },
  { id: "prolactin", labelIt: "Prolattina", unit: "ng/mL", category: "hormonal", impact: "neutral" },
  { id: "gaba", labelIt: "GABA (contesto)", unit: "a.u.", category: "neural", impact: "neutral" },
  { id: "serotonin", labelIt: "Serotonina", unit: "a.u.", category: "neural", impact: "neutral" },
  { id: "dopamine", labelIt: "Dopamina", unit: "a.u.", category: "neural", impact: "neutral" },
  { id: "gastrin", labelIt: "Gastrina", unit: "pg/mL", category: "gastro_intestinal", impact: "neutral" },
  { id: "ghrelin", labelIt: "Ghrelina", unit: "pg/mL", category: "gastro_intestinal", impact: "neutral" },
  { id: "leptin", labelIt: "Leptina", unit: "ng/mL", category: "gastro_intestinal", impact: "neutral" },
  { id: "lh", labelIt: "LH", unit: "mUI/mL", category: "gonadal", impact: "neutral" },
  { id: "fsh", labelIt: "FSH", unit: "mUI/mL", category: "gonadal", impact: "neutral" },
  { id: "estradiol", labelIt: "Estradiolo", unit: "pg/mL", category: "gonadal", impact: "neutral" },
] as const;

const SHORT_DISCLAIMERS = [
  "BioEnergetic (vista semplificata): tile e striscia 24 h sono generate da OpenAI a partire da diario, allenamenti e contesto giornata caricato dal server.",
  "Valori con badge «Stimato»: non sono referto di laboratorio né diagnosi clinica.",
] as const;

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatTileValue(spec: BioenergeticGenerativeTileSpec, v: number): string {
  if (spec.id === "insulin_proxy" || spec.id === "homa_ir") return `${Math.round(v * 100) / 100}`;
  if (spec.unit === "a.u.") return `${Math.round(v * 100) / 100}`;
  if (spec.unit === "score 0–100") return `${Math.round(Math.max(0, Math.min(100, v)))}`;
  if (spec.unit === "mmol/L") return `${Math.round(v * 100) / 100}`;
  if (spec.unit === "mg/L" || spec.unit === "ng/mL" || spec.unit === "µg/dL" || spec.unit === "mUI/L")
    return Number.isInteger(v) ? `${v}` : `${Math.round(v * 10) / 10}`;
  if (spec.unit === "pg/mL" || spec.unit === "µUI/mL" || spec.unit === "ng/dL")
    return `${Math.round(v * 10) / 10}`;
  return `${Math.round(v * 100) / 100}`;
}

function parseTilesFromGenerativeResponse(root: Record<string, unknown>): Map<string, number> {
  const m = new Map<string, number>();
  const arr = root.tiles;
  if (!Array.isArray(arr)) return m;
  for (const row of arr) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id.trim() : "";
    if (!id) continue;
    const rawV = rec.value;
    const n = typeof rawV === "number" ? rawV : Number(rawV);
    if (!Number.isFinite(n)) continue;
    m.set(id, n);
  }
  return m;
}

export function buildMetricTilesFromGenerativeMap(valuesById: Map<string, number>): BioenergeticMetricTile[] {
  return BIOENERGETIC_GENERATIVE_TILE_PANEL.map((spec) => {
    const v = valuesById.get(spec.id);
    if (v == null || !Number.isFinite(v)) {
      return {
        id: spec.id,
        labelIt: spec.labelIt,
        unit: spec.unit,
        displayValue: "—",
        numericValue: null,
        provenance: "absent",
        impact: spec.impact,
        category: spec.category,
      };
    }
    return {
      id: spec.id,
      labelIt: spec.labelIt,
      unit: spec.unit,
      displayValue: formatTileValue(spec, v),
      numericValue: v,
      provenance: "estimated",
      impact: spec.impact,
      category: spec.category,
    };
  });
}

function placeholderTiles(): BioenergeticMetricTile[] {
  return buildMetricTilesFromGenerativeMap(new Map());
}

async function requestOpenAiGenerativeBioenergeticDay(
  compact: Record<string, unknown>,
  opts: { apiKey: string; model: string },
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const skipGlu = Boolean(compact.skip_glucose_predictor);
  const system = [
    "Sei il motore generativo EMPATHY Pro 2 — BioEnergetic (solo output illustrativo).",
    "Ricevi `bioenergetic_strip_ai_reality_inputs_v2` + `tile_catalog`: pasti, sedute, totali, conteggi stream, metadati glucosio/lattato.",
    "Devi restituire SOLO JSON valido.",
    "Campo `tiles`: array di oggetti { id, value } — un elemento per OGNI voce in `tile_catalog` (stesso `id`), `value` numerico plausibile (coerente con pasti, CHO, TSS, sonno/stress implicito dai dati).",
    "Vincoli temporali (obbligatori): usa `temporal_anchors` e `meals[].resolved_timeline_iso` come orari di riferimento, non inventare pasti/sedute a caso.",
    "Per ogni pasto con CHO o kcal materiali: in `glucose_mmol_15m` (se richiesto) e `insulin_proxy_score_24` devi avere risposta entro ~20–120 min DOPO quel timestamp (picco o salita proporzionata a CHO/kcal; pasti multipli → picchi distinti se orari distinti).",
    "Per sedute eseguite/pianificate: in glucosio/lattato modula nell’intervallo orario della seduta (usa `payload`/durata da anchor); lattato può salire durante sforzo; glucosio non restare piatto se TSS/kcal seduta sono significativi.",
    "Cortisolo e ACTH (24 valori): rispetta circadianità grossolana (notte più bassa, giorno più alto); se c’è seduta intensa (TSS alto) modula nelle ore della seduta; non curve sinusoidali identiche fasulle se gli anchor pasto/seduta sono asimmetrici.",
    skipGlu
      ? "NON includere `glucose_mmol_15m` (CGM denso quel giorno)."
      : "Includi `glucose_mmol_15m`: 96 numeri (mmol/L) per la giornata.",
    "Includi `lactate_mmol_15m` (96), `cortisol_ug_dl_24`, `acth_pg_ml_24`, `insulin_proxy_score_24` (24 numeri ciascuno).",
    "`disclaimer_it` obbligatorio in italiano (breve). Opzionale `note_it`.",
    "Non copiare numeri da kernel/tile deterministiche del server: però gli ORARI e l’ordine di grandezza delle risposte devono rispettare i vincoli sopra sugli input.",
  ].join(" ");

  const user = `Genera tile + striscia per:\n\n${JSON.stringify(compact)}`;

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.35,
        max_tokens: 14000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }

  if (!response.ok) {
    const t = await response.text().catch(() => "");
    return { ok: false, error: `OpenAI HTTP ${response.status}: ${t.slice(0, 200)}` };
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: "empty_response" };
  return { ok: true, text };
}

/**
 * Path prodotto `GET bioenergetics/day`: una chiamata OpenAI sostituisce tile + striscia;
 * azzera layer legacy (pathway, serie, scheletro, evidenza, BIA) lato risposta.
 */
export async function applyBioenergeticOpenAiGenerativeOverlay(
  vm: BioenergeticsDayViewModel,
  slice: BioenergeticDayMemorySlice,
): Promise<BioenergeticsDayViewModel> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    return {
      ...vm,
      metricTiles: placeholderTiles(),
      chart24h: [],
      series: [],
      evidenceConditionedLayer: null,
      interactionSkeleton: null,
      biaLiteratureSummary: null,
      interpretationHints: [],
      continuousMonitoring: { layer: "ai_from_inputs_v1", channels: [] },
      disclaimers: [...SHORT_DISCLAIMERS, "Imposta OPENAI_API_KEY sul server per generare tile e striscia."],
    };
  }

  const skipGlu = shouldSkipGlucosePredictor(vm);

  const compact: Record<string, unknown> = {
    ...buildOpenAiStripRealityCompact(vm, slice, skipGlu),
    tile_catalog: BIOENERGETIC_GENERATIVE_TILE_PANEL.map((t) => ({
      id: t.id,
      label_it: t.labelIt,
      unit: t.unit,
      category: t.category,
    })),
    timeline_digest: vm.timeline.slice(0, 50).map((e) => ({
      ts: e.ts,
      type: e.type,
      title: e.title.slice(0, 120),
    })),
  };

  const model = (process.env.OPENAI_BIOENERGETIC_MODEL ?? "").trim() || "gpt-4o-mini";
  const ai = await requestOpenAiGenerativeBioenergeticDay(compact, { apiKey, model });
  if (!ai.ok) {
    return {
      ...vm,
      metricTiles: placeholderTiles(),
      chart24h: [],
      series: [],
      evidenceConditionedLayer: null,
      interactionSkeleton: null,
      biaLiteratureSummary: null,
      interpretationHints: [],
      continuousMonitoring: { layer: "ai_from_inputs_v1", channels: [] },
      disclaimers: [...SHORT_DISCLAIMERS, `OpenAI: ${ai.error}`],
    };
  }

  const root = extractJsonObject(ai.text);
  if (!root) {
    return {
      ...vm,
      metricTiles: placeholderTiles(),
      chart24h: [],
      series: [],
      evidenceConditionedLayer: null,
      interactionSkeleton: null,
      biaLiteratureSummary: null,
      interpretationHints: [],
      continuousMonitoring: { layer: "ai_from_inputs_v1", channels: [] },
      disclaimers: [...SHORT_DISCLAIMERS, "OpenAI: JSON non interpretabile."],
    };
  }

  const stripParsed = parseStripAiOpenAiContent(ai.text);
  const tilesById = parseTilesFromGenerativeResponse(root);
  const metricTiles = buildMetricTilesFromGenerativeMap(tilesById);
  const channels = stripParsed ? buildMonitoringChannelsFromStripAiParse(vm, stripParsed) : [];

  const noteLine =
    typeof root.note_it === "string"
      ? root.note_it.trim().slice(0, 400)
      : typeof root.noteIt === "string"
        ? root.noteIt.trim().slice(0, 400)
        : "";
  const disc = stripParsed?.disclaimerIt?.trim() ?? "";

  const disclaimers = [
    ...SHORT_DISCLAIMERS,
    disc ? `Modello: ${disc}` : "",
    noteLine ? `Nota: ${noteLine}` : "",
  ].filter(Boolean);

  return {
    ...vm,
    metricTiles,
    chart24h: [],
    series: [],
    evidenceConditionedLayer: null,
    interactionSkeleton: null,
    biaLiteratureSummary: null,
    interpretationHints: [],
    continuousMonitoring: { layer: "ai_from_inputs_v1", channels },
    disclaimers,
  };
}
