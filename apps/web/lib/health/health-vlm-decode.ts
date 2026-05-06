/**
 * Decode VLM (vision) di referti health (PDF-scan / immagini) verso struttura
 * canonica per `panelType` ∈ blood/microbiota/epigenetics/hormones/inflammation/oxidative_stress.
 *
 * Architecture gate (`empathy_generative_core.mdc`):
 *   AI ≠ motore. Il VLM produce **proposte** (numeri + confidence) che NON
 *   atterrano direttamente in `biomarker_panels`: vengono persistite come
 *   `proposed_structured_patches` su `interpretation_staging_runs` e diventano
 *   verità solo dopo conferma utente / coach.
 *
 * Fallback: Claude (Anthropic) → GPT-4o (OpenAI). Nessun provider → return null.
 *
 * Env:
 *   - `ANTHROPIC_API_KEY` (+ opzionale `ANTHROPIC_VISION_MODEL`, default `claude-sonnet-4-5-20250929`)
 *   - `OPENAI_API_KEY` (+ opzionale `OPENAI_VISION_MODEL`, default `gpt-4o-mini`)
 */

import "server-only";

export type HealthPanelKindForVlm =
  | "blood"
  | "microbiota"
  | "epigenetics"
  | "hormones"
  | "inflammation"
  | "oxidative_stress";

export type HealthFieldProposal = {
  field: string;
  value: number | string | null;
  unit?: string | null;
  referenceRange?: { low: number | null; high: number | null } | null;
  confidence: number;
  notes?: string | null;
};

export type HealthVlmDecodeResult = {
  providerUsed: "anthropic" | "openai";
  modelUsed: string;
  panelType: HealthPanelKindForVlm;
  fields: HealthFieldProposal[];
  rawJson: Record<string, unknown>;
  qualityNotes: string[];
  detectedProvider: string | null;
};

const SCHEMA_HINTS: Record<HealthPanelKindForVlm, string> = {
  blood:
    "blood (sangue): emoglobina g/dL, ematocrito %, eritrociti M/uL, leucociti K/uL, piastrine K/uL, ferritina ng/mL, sideremia µg/dL, transferrina mg/dL, vitamina_d_25oh ng/mL, vitamina_b12 pg/mL, folati ng/mL, glicemia mg/dL, hba1c %, colesterolo_tot mg/dL, ldl mg/dL, hdl mg/dL, trigliceridi mg/dL, ast U/L, alt U/L, ggt U/L, creatinina mg/dL, urea mg/dL, sodio mmol/L, potassio mmol/L, magnesio mg/dL, calcio mg/dL, omocisteina umol/L. Esprimi nomi in snake_case lowercase.",
  microbiota:
    "microbiota: phylum_<nome> con abbondanza %, family_<nome> %, genus_<nome> %, species_<nome> %; diversita_shannon, diversita_simpson, diversita_chao, indice_disbiosi (0-100), butyrate_producers %, lps_producers %, bile_acid_metab %, scfa_score, akkermansia_pct, faecalibacterium_pct, lactobacillus_pct, bifidobacterium_pct, roseburia_pct, prevotella_pct, bacteroides_pct, fusobacterium_pct. Tutti in snake_case lowercase.",
  epigenetics:
    "epigenetics: eta_biologica_anni, eta_cronologica_anni, gap_anni, telomere_length_kb, metilazione_score (0-100), pace_of_aging, dunedin_pace, horvath_clock, hannum_clock, phenoage, grim_age, smoke_pack_years, dna_repair_score, mitochondrial_score, inflammaging_score, oxidative_methylation, longevity_score. Tutti snake_case.",
  hormones:
    "hormones: cortisolo_am ug/dL, cortisolo_pm ug/dL, dhea_s ug/dL, testosterone_totale ng/dL, testosterone_libero pg/mL, estradiolo pg/mL, progesterone ng/mL, lh mUI/mL, fsh mUI/mL, prolattina ng/mL, tsh mUI/L, t3_libero pg/mL, t4_libero ng/dL, igf1 ng/mL, gh ng/mL, melatonina_notturna pg/mL, insulina uUI/mL, homa_ir, leptina ng/mL, grelina pg/mL.",
  inflammation:
    "inflammation: pcr_us mg/L, vss mm/h, il6 pg/mL, il1b pg/mL, il10 pg/mL, tnf_alpha pg/mL, ldl_ox U/L, omocisteina umol/L, fibrinogeno mg/dL, calprotectina_fecale ug/g, lpa mg/dL, neopterina nmol/L, ferritina ng/mL, asma_score.",
  oxidative_stress:
    "oxidative_stress: d_roms U_carr (riferim 250-300), bap_score uM, glutatione_ridotto umol/L, glutatione_ossidato umol/L, glutatione_ratio, sod U/g_hb, catalasi U/g_hb, gpx U/g_hb, vitamina_e_alfatocoferolo mg/L, vitamina_c mg/L, coq10 ng/mL, malondialdeide_mda umol/L, 8_ohdg ng/mg_creat, ros_total, capacity_total_antiox.",
};

function buildPromptText(panelType: HealthPanelKindForVlm): string {
  return [
    "Sei un assistente esperto di referti clinici (Italia / EU). Estrai dal documento allegato i parametri quantitativi.",
    "",
    `Tipo di referto: ${panelType}.`,
    `Schema target: ${SCHEMA_HINTS[panelType]}`,
    "",
    "Regole rigide:",
    "1. NON inventare valori: se non sei sicuro, ometti il campo o usa confidence ≤ 0.4.",
    "2. Restituisci SOLO un oggetto JSON, niente testo extra.",
    "3. Confidence = 0..1 in base alla leggibilità del valore nel referto (0.9+ se chiaramente stampato; 0.6-0.85 se interpretato; 0.4- se incerto).",
    "4. Se nel referto è presente l'unità di misura, includila in `unit`. Se il range di riferimento è stampato, includilo in `reference_range`.",
    "5. Per microbiota: usa abbondanze relative in percentuale (0-100), non frazioni.",
    "6. Riconosci nome del laboratorio / provider se presente (es. 'Atlas Biomed', 'Synlab', 'Viome', 'Lifeline'); riportalo come `detected_provider`.",
    "",
    "Schema JSON output:",
    "{",
    '  "detected_provider": string | null,',
    '  "fields": [',
    '    { "field": "snake_case_key", "value": number | string | null, "unit": string | null, "reference_range": { "low": number | null, "high": number | null } | null, "confidence": 0..1, "notes": string | null }',
    "  ],",
    '  "quality_notes": [string]',
    "}",
  ].join("\n");
}

function isFieldProposal(v: unknown): v is HealthFieldProposal {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  if (typeof r.field !== "string" || !r.field.trim()) return false;
  const conf = typeof r.confidence === "number" ? r.confidence : null;
  if (conf == null || !Number.isFinite(conf) || conf < 0 || conf > 1.001) return false;
  return true;
}

function normalizeFields(rawFields: unknown): HealthFieldProposal[] {
  if (!Array.isArray(rawFields)) return [];
  const out: HealthFieldProposal[] = [];
  for (const raw of rawFields) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const r = raw as Record<string, unknown>;
    const field = String(r.field ?? "").trim().toLowerCase().replace(/[\s\-/]+/g, "_");
    if (!field) continue;
    let value: number | string | null = null;
    if (typeof r.value === "number" && Number.isFinite(r.value)) value = r.value;
    else if (typeof r.value === "string" && r.value.trim()) value = r.value.trim();
    const unit = typeof r.unit === "string" && r.unit.trim() ? r.unit.trim() : null;
    const rrRaw = r.reference_range;
    let referenceRange: { low: number | null; high: number | null } | null = null;
    if (rrRaw && typeof rrRaw === "object" && !Array.isArray(rrRaw)) {
      const rr = rrRaw as Record<string, unknown>;
      const low = typeof rr.low === "number" && Number.isFinite(rr.low) ? rr.low : null;
      const high = typeof rr.high === "number" && Number.isFinite(rr.high) ? rr.high : null;
      if (low != null || high != null) referenceRange = { low, high };
    }
    let confidence = typeof r.confidence === "number" ? r.confidence : 0.4;
    if (!Number.isFinite(confidence)) confidence = 0.4;
    confidence = Math.max(0, Math.min(1, confidence));
    const notes = typeof r.notes === "string" && r.notes.trim() ? r.notes.trim().slice(0, 240) : null;
    const proposal: HealthFieldProposal = { field, value, unit, referenceRange, confidence, notes };
    if (isFieldProposal(proposal)) out.push(proposal);
  }
  return out;
}

function parseDecodedJson(raw: string): {
  detected_provider: string | null;
  fields: HealthFieldProposal[];
  quality_notes: string[];
  rawJson: Record<string, unknown>;
} | null {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
    const detected = typeof obj.detected_provider === "string" ? obj.detected_provider.trim() || null : null;
    const fields = normalizeFields(obj.fields);
    const qn = Array.isArray(obj.quality_notes)
      ? (obj.quality_notes as unknown[]).map((s) => (typeof s === "string" ? s : String(s))).filter(Boolean)
      : [];
    return { detected_provider: detected, fields, quality_notes: qn, rawJson: obj };
  } catch {
    return null;
  }
}

async function callAnthropicVision(args: {
  apiKey: string;
  model: string;
  base64: string;
  mediaType: string;
  prompt: string;
}): Promise<string | null> {
  try {
    const isPdf = /^application\/pdf$/i.test(args.mediaType);
    const sourceBlock = isPdf
      ? {
          type: "document" as const,
          source: { type: "base64" as const, media_type: "application/pdf" as const, data: args.base64 },
        }
      : {
          type: "image" as const,
          source: { type: "base64" as const, media_type: args.mediaType, data: args.base64 },
        };
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": args.apiKey,
        "anthropic-version": "2023-06-01",
        // PDF support beta header (Anthropic accepts the message even without it now,
        // but we keep the explicit beta header for forward compatibility).
        ...(isPdf ? { "anthropic-beta": "pdfs-2024-09-25" } : {}),
      },
      body: JSON.stringify({
        model: args.model,
        max_tokens: 4096,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: [sourceBlock, { type: "text", text: args.prompt }],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (json.content ?? [])
      .filter((p) => p?.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("\n");
    return text.trim() || null;
  } catch {
    return null;
  }
}

async function callOpenAiVision(args: {
  apiKey: string;
  model: string;
  base64: string;
  mediaType: string;
  prompt: string;
}): Promise<string | null> {
  try {
    const dataUrl = `data:${args.mediaType};base64,${args.base64}`;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Sei un assistente esperto di referti clinici. Rispondi SOLO con un oggetto JSON valido, niente testo extra.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: args.prompt },
              { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Provo Claude → GPT-4o → null. Restituisce sempre **proposte** (no scrittura DB qui).
 */
export async function decodeHealthDocumentWithVlm(input: {
  buffer: Buffer;
  mime: string;
  panelType: HealthPanelKindForVlm;
}): Promise<HealthVlmDecodeResult | null> {
  const { buffer, mime, panelType } = input;
  if (!buffer.length) return null;

  const allowedImage = /^image\/(jpeg|jpg|png|webp|gif)$/i;
  const isPdf = /^application\/pdf$/i.test(mime);
  if (!allowedImage.test(mime) && !isPdf) return null;

  const base64 = buffer.toString("base64");
  const prompt = buildPromptText(panelType);
  const normalizedMedia = isPdf ? "application/pdf" : mime.replace(/^image\/jpg$/i, "image/jpeg");

  const anthropicKey = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  const anthropicModel =
    (process.env.ANTHROPIC_VISION_MODEL ?? "").trim() || "claude-sonnet-4-5-20250929";
  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const openaiModel = (process.env.OPENAI_VISION_MODEL ?? "").trim() || "gpt-4o-mini";

  if (anthropicKey) {
    const raw = await callAnthropicVision({
      apiKey: anthropicKey,
      model: anthropicModel,
      base64,
      mediaType: normalizedMedia,
      prompt,
    });
    if (raw) {
      const parsed = parseDecodedJson(raw);
      if (parsed && parsed.fields.length > 0) {
        return {
          providerUsed: "anthropic",
          modelUsed: anthropicModel,
          panelType,
          fields: parsed.fields,
          rawJson: parsed.rawJson,
          qualityNotes: parsed.quality_notes,
          detectedProvider: parsed.detected_provider,
        };
      }
    }
  }

  // GPT-4o non accetta PDF nelle chat completions: solo immagini.
  if (openaiKey && !isPdf) {
    const raw = await callOpenAiVision({
      apiKey: openaiKey,
      model: openaiModel,
      base64,
      mediaType: normalizedMedia,
      prompt,
    });
    if (raw) {
      const parsed = parseDecodedJson(raw);
      if (parsed && parsed.fields.length > 0) {
        return {
          providerUsed: "openai",
          modelUsed: openaiModel,
          panelType,
          fields: parsed.fields,
          rawJson: parsed.rawJson,
          qualityNotes: parsed.quality_notes,
          detectedProvider: parsed.detected_provider,
        };
      }
    }
  }

  return null;
}
