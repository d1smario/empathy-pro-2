/**
 * Classificazione tassonomia USDA via OpenAI (structured JSON).
 * AI etichetta ogni alimento in base a descrizione + macro reali — NESSUN conteggio fisso
 * (es. vegani = quanti sono davvero vegani nel catalogo, non 1200 arbitrari).
 */

import type { FdcFoodTaxonomy } from "@empathy/contracts";
import {
  sanitizeTagArray,
  taxonomyAllowlistsForPrompt,
  ALLOWED_AMINO_PROFILE,
  ALLOWED_DIET_EXCLUDE,
  ALLOWED_DIET_PROFILE,
  ALLOWED_FOOD_FAMILY,
  ALLOWED_MACRO_DOMINANT,
  ALLOWED_MEAL_COURSE,
  ALLOWED_MEAL_ROLE,
  ALLOWED_NUTRIENT_DENSITY,
  ALLOWED_SLOT_FIT,
} from "@/lib/nutrition/v2/fdc-taxonomy-allowlists";
import { mergeTaxonomyArrays } from "@/lib/nutrition/v2/fdc-food-taxonomy";
import { classifyFdcFoodRow } from "@/lib/nutrition/v2/classify-fdc-description";

export const AI_CLASSIFIER_VERSION = "empathy_v2_ai_hybrid_v1";

export type FdcAiClassifyInput = {
  fdcId: number;
  description: string;
  foodCategory?: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g?: number | null;
};

type AiItemOut = {
  fdc_id: number;
  meal_course?: unknown;
  food_family?: unknown;
  macro_dominant?: unknown;
  slot_fit?: unknown;
  diet_profile?: unknown;
  diet_exclude?: unknown;
  meal_role?: unknown;
  amino_profile?: unknown;
  nutrient_density?: unknown;
};

function sanitizeAiItem(raw: AiItemOut): Omit<FdcFoodTaxonomy, "classifierVersion"> {
  return {
    mealCourse: sanitizeTagArray(raw.meal_course, ALLOWED_MEAL_COURSE),
    foodFamily: sanitizeTagArray(raw.food_family, ALLOWED_FOOD_FAMILY),
    macroDominant: sanitizeTagArray(raw.macro_dominant, ALLOWED_MACRO_DOMINANT),
    slotFit: sanitizeTagArray(raw.slot_fit, ALLOWED_SLOT_FIT),
    dietProfile: sanitizeTagArray(raw.diet_profile, ALLOWED_DIET_PROFILE),
    dietExclude: sanitizeTagArray(raw.diet_exclude, ALLOWED_DIET_EXCLUDE),
    mealRole: sanitizeTagArray(raw.meal_role, ALLOWED_MEAL_ROLE),
    aminoProfile: sanitizeTagArray(raw.amino_profile, ALLOWED_AMINO_PROFILE),
    nutrientDensity: sanitizeTagArray(raw.nutrient_density, ALLOWED_NUTRIENT_DENSITY),
  };
}

/** Coerenza minima: vegan ⇔ no animal in diet_exclude; celiac-friendly ⇔ no gluten in diet_exclude. */
function enforceDietConsistency(t: Omit<FdcFoodTaxonomy, "classifierVersion">): void {
  const hasAnimal = t.dietExclude.includes("animal");
  if (hasAnimal) {
    t.dietProfile = t.dietProfile.filter((p) => p !== "vegan" && p !== "vegetarian");
  } else if (t.dietProfile.includes("vegan")) {
    t.dietProfile = mergeTaxonomyArrays(t.dietProfile, ["vegetarian", "lactose_free"]);
  }
  if (t.dietExclude.includes("gluten")) {
    t.dietProfile = t.dietProfile.filter((p) => p !== "celiac");
  }
  if (t.foodFamily.includes("pesce") || t.foodFamily.includes("carne")) {
    t.dietExclude = mergeTaxonomyArrays(t.dietExclude, ["animal" as const]);
    t.dietProfile = t.dietProfile.filter((p) => p !== "vegan" && p !== "vegetarian");
  }
  if (t.foodFamily.includes("latticino") || t.foodFamily.includes("uova")) {
    t.dietExclude = mergeTaxonomyArrays(t.dietExclude, ["animal" as const, "lactose" as const]);
    t.dietProfile = t.dietProfile.filter((p) => p !== "vegan");
  }
}

function mergeWithRulesFallback(
  ai: Omit<FdcFoodTaxonomy, "classifierVersion">,
  input: FdcAiClassifyInput,
): FdcFoodTaxonomy {
  const rules = classifyFdcFoodRow({
    description: input.description,
    kcalPer100g: input.kcalPer100g,
    proteinG: input.proteinPer100g,
    carbsG: input.carbsPer100g,
    fatG: input.fatPer100g,
    fiberG: input.fiberPer100g ?? undefined,
  });

  const merged: Omit<FdcFoodTaxonomy, "classifierVersion"> = {
    mealCourse: ai.mealCourse.length ? ai.mealCourse : rules.mealCourse,
    foodFamily: mergeTaxonomyArrays(ai.foodFamily, rules.foodFamily),
    macroDominant: ai.macroDominant.length ? ai.macroDominant : rules.macroDominant,
    slotFit: ai.slotFit.length ? ai.slotFit : rules.slotFit,
    dietProfile: mergeTaxonomyArrays(ai.dietProfile, rules.dietProfile),
    dietExclude: mergeTaxonomyArrays(ai.dietExclude, rules.dietExclude),
    mealRole: ai.mealRole.length ? ai.mealRole : rules.mealRole,
    aminoProfile: mergeTaxonomyArrays(ai.aminoProfile, rules.aminoProfile),
    nutrientDensity: mergeTaxonomyArrays(ai.nutrientDensity, rules.nutrientDensity),
  };

  enforceDietConsistency(merged);

  return { ...merged, classifierVersion: AI_CLASSIFIER_VERSION };
}

async function callOpenAiBatch(
  items: FdcAiClassifyInput[],
  opts: { apiKey: string; model: string },
): Promise<{ ok: true; items: AiItemOut[] } | { ok: false; error: string }> {
  const allowlists = taxonomyAllowlistsForPrompt();
  const compact = items.map((it) => ({
    fdc_id: it.fdcId,
    description: it.description.slice(0, 200),
    food_category: it.foodCategory?.slice(0, 80) ?? null,
    kcal_100g: it.kcalPer100g,
    protein_g: it.proteinPer100g,
    carbs_g: it.carbsPer100g,
    fat_g: it.fatPer100g,
    fiber_g: it.fiberPer100g ?? null,
  }));

  const system = [
    "Sei un classificatore alimentare USDA per Empathy Pro 2 (meal plan sportivo).",
    "Per OGNI alimento nel batch, assegna tag SOLO dalle allowlist fornite.",
    "NON inventare tag fuori allowlist. Array vuoti [] se non applicabile.",
    "",
    "Regole dieta (basate su composizione reale, NON conteggi fissi):",
    "- diet_profile 'vegan': SOLO se l'alimento è realmente vegano (zero carne, pesce, uova, latte, miele, gelatina).",
    "- diet_profile 'vegetarian': no carne/pesce; può avere uova/latticini.",
    "- diet_exclude 'animal': se contiene qualsiasi derivato animale.",
    "- diet_exclude 'gluten': pasta, pane, farro, orzo, segale, kamut, spelt, wheat, malt (se cereale glutinoso).",
    "- diet_exclude 'lactose': latticini con lattosio (latte, yogurt, formaggi freschi).",
    "- diet_exclude 'grain': cereali/grani (paleo).",
    "- diet_exclude 'legume': legumi (paleo strict).",
    "- 'celiac' in diet_profile: solo alimenti naturalmente senza glutine (riso, quinoa, patate, verdura, frutta, carne, pesce, uova).",
    "- 'mediterranean': alimenti tipici dieta mediterranea (olio, pesce, verdura, legumi, pasta, pane integrale).",
    "- 'thai': ingredienti cucina thailandese (coconut milk, lemongrass, fish sauce, curry, basil thai, rice noodles).",
    "",
    "Esempio pasta cooked: meal_course [primo_carb], diet_exclude [gluten, grain], diet_profile [mediterranean, omnivore], slot_fit [main_meal], meal_role [primo]. NON vegan, NON celiac.",
    "",
    `Allowlists: ${allowlists}`,
    "",
    'Output JSON: { "items": [ { "fdc_id": number, "meal_course": [], "food_family": [], "macro_dominant": [], "slot_fit": [], "diet_profile": [], "diet_exclude": [], "meal_role": [], "amino_profile": [], "nutrient_density": [] } ] }',
    "Un oggetto per ogni fdc_id in input, stesso ordine.",
  ].join("\n");

  const user = `Classifica questo batch:\n${JSON.stringify(compact)}`;

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
        temperature: 0.1,
        max_tokens: Math.min(16000, Math.max(4000, items.length * 180)),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }

  if (!response.ok) {
    const txt = (await response.text().catch(() => "")).slice(0, 300);
    return { ok: false, error: `openai_http_${response.status}: ${txt}` };
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: "empty_response" };

  try {
    const parsed = JSON.parse(text) as { items?: AiItemOut[] };
    if (!Array.isArray(parsed.items)) return { ok: false, error: "invalid_json_shape" };
    return { ok: true, items: parsed.items };
  } catch {
    return { ok: false, error: "json_parse_error" };
  }
}

/**
 * Classifica un batch con AI; fallback rules-only se API assente o errore.
 */
export async function classifyFdcFoodBatchHybrid(
  items: FdcAiClassifyInput[],
  options?: { apiKey?: string; model?: string },
): Promise<FdcFoodTaxonomy[]> {
  const apiKey = (options?.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
  const model = (options?.model ?? process.env.OPENAI_FDC_TAXONOMY_MODEL ?? "").trim() || "gpt-4o-mini";

  if (!apiKey || items.length === 0) {
    return items.map((it) =>
      classifyFdcFoodRow({
        description: it.description,
        kcalPer100g: it.kcalPer100g,
        proteinG: it.proteinPer100g,
        carbsG: it.carbsPer100g,
        fatG: it.fatPer100g,
        fiberG: it.fiberPer100g ?? undefined,
      }),
    );
  }

  const ai = await callOpenAiBatch(items, { apiKey, model });
  if (!ai.ok) {
    return items.map((it) =>
      classifyFdcFoodRow({
        description: it.description,
        kcalPer100g: it.kcalPer100g,
        proteinG: it.proteinPer100g,
        carbsG: it.carbsPer100g,
        fatG: it.fatPer100g,
        fiberG: it.fiberPer100g ?? undefined,
      }),
    );
  }

  const byId = new Map<number, AiItemOut>();
  for (const row of ai.items) {
    const id = Math.round(Number(row.fdc_id));
    if (Number.isFinite(id)) byId.set(id, row);
  }

  return items.map((it) => {
    const raw = byId.get(it.fdcId);
    if (!raw) {
      return classifyFdcFoodRow({
        description: it.description,
        kcalPer100g: it.kcalPer100g,
        proteinG: it.proteinPer100g,
        carbsG: it.carbsPer100g,
        fatG: it.fatPer100g,
        fiberG: it.fiberPer100g ?? undefined,
      });
    }
    const sanitized = sanitizeAiItem(raw);
    return mergeWithRulesFallback(sanitized, it);
  });
}
