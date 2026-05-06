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

/**
 * Schema canonico per le proposte VLM.
 *
 * Le chiavi qui SONO le stesse che i selettori (`readNum`) della UI Health
 * leggono per popolare grafici e card. Allineamento chiavi obbligatorio:
 * il VLM deve emettere `crp_mg_l` (non `pcr_us`), `cortisol_am` (non
 * `cortisolo_am`), `firmicutes_pct`, `methylation_score`, ecc. Gli alias
 * italiani sono comunque accettati lato consumer per resilienza, ma il
 * canonical è inglese snake_case lowercase.
 */
const SCHEMA_HINTS: Record<HealthPanelKindForVlm, string> = {
  blood:
    "blood (esami del sangue): hb (emoglobina) g/dL, hematocrit %, rbc M/uL, wbc K/uL, plt K/uL, ferritin ng/mL, transferrin mg/dL, iron_serum ug/dL, vit_d (25-OH-D) ng/mL, b12 pg/mL, folate ng/mL, glucose mg/dL, hba1c %, total_cholesterol mg/dL, ldl mg/dL, hdl mg/dL, triglycerides mg/dL, ast U/L, alt U/L, ggt U/L, creatinine mg/dL, urea mg/dL, sodium mmol/L, potassium mmol/L, magnesium mg/dL, calcium mg/dL, homocysteine umol/L, crp_mg_l (PCR) mg/L, tsh mUI/L. snake_case lowercase, valori inglesi quando possibile.",
  microbiota:
    "microbiota (analisi del microbiota intestinale): a livello phylum SEMPRE includere quando presenti `firmicutes_pct`, `bacteroidetes_pct`, `proteobacteria_pct`, `actinobacteria_pct`, `verrucomicrobia_pct`, `fusobacteria_pct` (abbondanze 0-100). Diversità: `diversity_shannon` (Shannon index), `diversity_simpson`, `diversity_chao`, `dysbiosis_index` (0-100). Generi/specie chiave: `akkermansia_pct`, `faecalibacterium_pct`, `lactobacillus_pct`, `bifidobacterium_pct`, `roseburia_pct`, `prevotella_pct`, `bacteroides_pct`. Funzionali: `butyrate_producers_pct`, `lps_producers_pct`, `scfa_score`. Famiglie/generi extra: usare `family_<nome>` o `genus_<nome>`.",
  epigenetics:
    "epigenetics (test epigenetico / orologio biologico): SEMPRE includere quando presenti `methylation_score` (0-100), `biological_age_years`, `chronological_age_years`, `biological_age_delta` (delta anni), `epigenetic_oxidative_stress` (0-100), `epigenetic_detox` (0-100), `epigenetic_repair` (0-100). Plus: `pace_of_aging` (DunedinPACE), `horvath_clock`, `hannum_clock`, `phenoage`, `grim_age`, `telomere_length_kb`, `inflammaging_score`, `mitochondrial_score`, `longevity_score`. snake_case.",
  hormones:
    "hormones (profilo ormonale): SEMPRE includere quando presenti `cortisol_am` (mattina) ug/dL, `cortisol_pm` (sera) ug/dL, `testosterone` ng/dL (totale), `testosterone_free` pg/mL, `tsh` mUI/L, `ft3` pg/mL, `ft4` ng/dL, `dhea_s` ug/dL, `igf1` ng/mL. Plus se presenti: `estradiol` pg/mL, `progesterone` ng/mL, `lh`, `fsh`, `prolactin` ng/mL, `gh`, `melatonin_night`, `insulin` uUI/mL, `homa_ir`, `leptin`, `ghrelin`. snake_case lowercase, **chiavi inglesi** (NON `cortisolo_am`).",
  inflammation:
    "inflammation (markers infiammatori): SEMPRE includere quando presenti `crp_mg_l` (PCR) mg/L, `il6` pg/mL, `tnf_alpha` pg/mL, `homocysteine` umol/L, `oxidized_ldl` U/L. Plus: `esr_mm_h` (VES) mm/h, `il1b`, `il10`, `fibrinogen` mg/dL, `fecal_calprotectin` ug/g, `lpa` mg/dL, `neopterin` nmol/L. snake_case lowercase, chiavi inglesi.",
  oxidative_stress:
    "oxidative_stress (stress ossidativo): SEMPRE includere quando presenti `d_roms` U_CARR (riferim 250-300), `bap` uM, `glutathione` umol/L, `sod` U/g_hb, `catalase` U/g_hb. Plus: `gpx` U/g_hb, `vitamin_e` mg/L, `vitamin_c` mg/L, `coq10` ng/mL, `mda` (malondialdehyde) umol/L, `8_ohdg` ng/mg_creat, `ros_total`, `total_antioxidant_capacity`. snake_case lowercase, chiavi inglesi.",
};

function buildPromptText(panelType: HealthPanelKindForVlm): string {
  return [
    "Sei un assistente esperto di referti clinici (Italia / EU). Estrai dal documento allegato TUTTI i parametri quantitativi presenti.",
    "",
    `Tipo di referto: ${panelType}.`,
    `Schema target (chiavi canoniche): ${SCHEMA_HINTS[panelType]}`,
    "",
    "Regole rigide:",
    "1. NON inventare valori: se non sei sicuro, ometti il campo o usa confidence ≤ 0.4.",
    "2. Restituisci SOLO un oggetto JSON, niente testo extra.",
    "3. Confidence = 0..1 in base alla leggibilità del valore nel referto (0.9+ se chiaramente stampato; 0.6-0.85 se interpretato; 0.4- se incerto).",
    "4. Se nel referto è presente l'unità di misura, includila in `unit`. Se il range di riferimento è stampato, includilo in `reference_range`.",
    "5. **Esaustività**: estrai ogni parametro che il referto contiene, non solo i principali. Includi anche colesterolo, lipidi, elettroliti, enzimi epatici, indici ematici secondari quando presenti.",
    "6. **Lessico canonico**: usa SEMPRE le chiavi inglesi snake_case del schema target (es. `cortisol_am`, NON `cortisolo_am`; `crp_mg_l`, NON `pcr_us`; `firmicutes_pct`, NON `firmicutes_phylum`). Se il referto è in italiano, traduci la chiave in inglese canonico ma mantieni il valore numerico esatto.",
    "7. Per microbiota: usa abbondanze relative in percentuale (0-100), non frazioni; preferisci sempre suffisso `_pct` per phylum/genus principali.",
    "8. Per epigenetics: includi sia `biological_age_years` che `chronological_age_years` quando presenti (oltre al delta).",
    "9. Riconosci nome del laboratorio / provider se presente (es. 'Atlas Biomed', 'Synlab', 'Viome', 'Lifeline', 'TruDiagnostic', 'Cerba'); riportalo come `detected_provider`.",
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
