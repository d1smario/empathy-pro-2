/**
 * Bridge deterministico tra il sistema intelligente (pathway modulation) e il generatore meal plan.
 *
 * Architettura (allineata a `empathy_generative_core.mdc` e regola utente):
 *  - Il sistema intelligente RAGIONA sui pathway (eritropoiesi, beta-ox, redox, gut, ecc.) e produce
 *    `cofactors` / `substrates` come *stringhe italiane* (es. "Vitamine B1/B3", "Magnesio (chinasi)",
 *    "Ferro eme/non eme", "B12, folati, ferro").
 *  - Il generatore NON deve riconoscere "eritropoiesi": riceve solo i NUTRIENT TARGET e cerca alimenti
 *    ricchi del nutriente nella cache USDA (`nutrition_fdc_foods`).
 *
 * Questo modulo è puro, sincrono, senza I/O: parser deterministico stringa → set di chiavi
 * `CanonicalFoodNutrients` (le stesse usate dallo scaler per il rollup nutrienti del piano).
 */

import type { CanonicalFoodNutrients } from "@/lib/nutrition/canonical-food-composition";

/** Sottoinsieme di `CanonicalFoodNutrients` realmente targetabile dai cofactors di pathway. */
export type NutrientTargetId = Extract<
  keyof CanonicalFoodNutrients,
  | "vitA_mcg_RAE"
  | "vitC_mg"
  | "vitD_mcg"
  | "vitE_mg"
  | "vitK_mcg"
  | "thiamineB1_mg"
  | "riboflavinB2_mg"
  | "niacinB3_mg"
  | "vitB6_mg"
  | "folate_mcg"
  | "vitB12_mcg"
  | "ca_mg"
  | "fe_mg"
  | "mg_mg"
  | "p_mg"
  | "k_mg"
  | "na_mg"
  | "zn_mg"
  | "se_mcg"
  | "fiberG"
  | "omega3G"
>;

export type NutrientTarget = {
  nutrientId: NutrientTargetId;
  labelIt: string;
  /** Provenienza testuale (per debug/log: stringa cofactor che ha innescato la mappatura). */
  sourceText: string;
};

/**
 * Pattern → nutrient target. Deterministico: lo stesso input produce lo stesso output.
 * I pattern sono case-insensitive e tollerano abbreviazioni comuni dei pathway (B12/B9/Mg/Fe/...).
 */
const PATTERNS: Array<{ regex: RegExp; nutrientId: NutrientTargetId; labelIt: string }> = [
  /** Vitamine B */
  { regex: /\b(b1|tiamin|thiamin)\b/i, nutrientId: "thiamineB1_mg", labelIt: "Tiamina (B1)" },
  { regex: /\b(b2|riboflav)\b/i, nutrientId: "riboflavinB2_mg", labelIt: "Riboflavina (B2)" },
  { regex: /\b(b3|niacin|niaci|nicotin)\b/i, nutrientId: "niacinB3_mg", labelIt: "Niacina (B3)" },
  { regex: /\b(b6|piridoss|pyridox)\b/i, nutrientId: "vitB6_mg", labelIt: "Vitamina B6" },
  { regex: /\b(b9|folat|folic|folati)\b/i, nutrientId: "folate_mcg", labelIt: "Folati (B9)" },
  { regex: /\b(b12|cobalam|cyanocobal|methylcobal)\b/i, nutrientId: "vitB12_mcg", labelIt: "Vitamina B12" },
  /** Vitamine liposolubili */
  { regex: /\b(vit(amina)?\s*a|retinol)\b/i, nutrientId: "vitA_mcg_RAE", labelIt: "Vitamina A" },
  { regex: /\b(vit(amina)?\s*c|ascorb)\b/i, nutrientId: "vitC_mg", labelIt: "Vitamina C" },
  { regex: /\b(vit(amina)?\s*d|colecalcif|cholecalcif)\b/i, nutrientId: "vitD_mcg", labelIt: "Vitamina D" },
  { regex: /\b(vit(amina)?\s*e|tocoferol|tocopher)\b/i, nutrientId: "vitE_mg", labelIt: "Vitamina E" },
  { regex: /\b(vit(amina)?\s*k|fillochin|phyllochin)\b/i, nutrientId: "vitK_mcg", labelIt: "Vitamina K" },
  /** Minerali principali (l'ordine conta: Mg/Fe prima dei generici per evitare match secondari) */
  { regex: /\b(magnes|\bmg\b)/i, nutrientId: "mg_mg", labelIt: "Magnesio" },
  { regex: /\b(ferr|iron|\bfe\b)/i, nutrientId: "fe_mg", labelIt: "Ferro" },
  { regex: /\b(zinc|zinco|\bzn\b)/i, nutrientId: "zn_mg", labelIt: "Zinco" },
  /** "selenio" ≠ `\bseleni\b` (suffix -o): prima regex non matchava mai il cofactor italiano. */
  { regex: /\b(seleni[o]?|selenium)\b/i, nutrientId: "se_mcg", labelIt: "Selenio" },
  { regex: /\b(calci|calcium)\b/i, nutrientId: "ca_mg", labelIt: "Calcio" },
  /**
   * Vietato `\bk\b` / `\bna\b`: in substrati tipo "Na/K" matchano lettere chimiche e saturano i boost
   * con falsi Potassio/Sodio prima dei cofactor redox (Vit C, Se, Zn).
   */
  { regex: /\b(potassio|potassium|kalium)\b/i, nutrientId: "k_mg", labelIt: "Potassio" },
  { regex: /\b(sodio|sodium|natrium)\b/i, nutrientId: "na_mg", labelIt: "Sodio" },
  { regex: /\b(fosfor|phosph|\bp\b)/i, nutrientId: "p_mg", labelIt: "Fosforo" },
  /** Macro funzionali rilevanti per pathway (omega-3, fibre) */
  { regex: /\b(omega.?3|epa|dha)\b/i, nutrientId: "omega3G", labelIt: "Omega-3 (EPA/DHA)" },
  { regex: /\b(fibre?|fiber)\b/i, nutrientId: "fiberG", labelIt: "Fibre alimentari" },
];

/** Righe solo operative su osmolalità elettroliti (Na/K simboli) — non sono target micronutrienti pasto. */
function isElectrolyteAbbreviationNoise(text: string): boolean {
  const t = text.trim();
  if (/elettroliti.{0,40}\bna\s*\/\s*k\b/i.test(t)) return true;
  if (/^\s*na\s*\/\s*k\b/i.test(t)) return true;
  return false;
}

/**
 * Estrae i nutrient target da una lista di stringhe cofactor / substrate (es. da `pathway.cofactors`).
 * Deduplica su `nutrientId` (prima occorrenza vince per la sourceText).
 *
 * Ordine atteso dal caller: **tutti i cofactors di tutti i pathway**, poi **substrates** — così i cofactor
 * redox (Vit C, Se, Zn, …) non vengono espulsi da falsi positivi su substrati del primo pathway.
 *
 * Output massimo: 10 (ranking USDA resta leggero; UI mostra max 3 linee per slot).
 */
export function pathwayCofactorsToNutrientTargets(strings: readonly string[]): NutrientTarget[] {
  const seen = new Set<NutrientTargetId>();
  const out: NutrientTarget[] = [];
  const MAX_TARGETS = 10;
  for (const raw of strings) {
    if (!raw) continue;
    const text = String(raw).trim();
    if (!text) continue;
    if (isElectrolyteAbbreviationNoise(text)) continue;
    for (const p of PATTERNS) {
      if (seen.has(p.nutrientId)) continue;
      if (p.regex.test(text)) {
        seen.add(p.nutrientId);
        out.push({ nutrientId: p.nutrientId, labelIt: p.labelIt, sourceText: text.slice(0, 140) });
      }
    }
    if (out.length >= MAX_TARGETS) break;
  }
  return out;
}

export type ActiveNutrientTarget = NutrientTarget & {
  catalogId?: string;
};

/** Mappa id catalogo funzionale → chiave canonica nutriente (subset con usdaRichSearch). */
export const CATALOG_TO_NUTRIENT_TARGET: Partial<Record<string, NutrientTargetId>> = {
  folate_b9: "folate_mcg",
  vitamin_c_redox: "vitC_mg",
  magnesium_kinase: "mg_mg",
  iron_heme: "fe_mg",
  iron_nonheme: "fe_mg",
  zinc_immunity: "zn_mg",
  selenium_redox: "se_mcg",
  omega3_epa_dha: "omega3G",
  fiber_gut: "fiberG",
  potassium_electrolyte: "k_mg",
  calcium_bone: "ca_mg",
  vitamin_d_hormone: "vitD_mcg",
  vitamin_b12_nerve: "vitB12_mcg",
  thiamine_b1: "thiamineB1_mg",
  riboflavin_b2: "riboflavinB2_mg",
  niacin_b3: "niacinB3_mg",
  vitamin_b6: "vitB6_mg",
};

export function catalogIdToNutrientTargetId(catalogId: string): NutrientTargetId | null {
  return CATALOG_TO_NUTRIENT_TARGET[catalogId] ?? null;
}

/**
 * Unifica bridge cofactor-regex (A) e catalogo funzionale (B) in un solo elenco deduplicato.
 */
export function buildActiveNutrientTargets(input: {
  cofactorStrings: readonly string[];
  catalogNutrientIds?: readonly string[];
}): ActiveNutrientTarget[] {
  const byId = new Map<NutrientTargetId, ActiveNutrientTarget>();
  for (const t of pathwayCofactorsToNutrientTargets(input.cofactorStrings)) {
    byId.set(t.nutrientId, { ...t });
  }
  for (const catalogId of input.catalogNutrientIds ?? []) {
    const nutrientId = catalogIdToNutrientTargetId(catalogId);
    if (!nutrientId || byId.has(nutrientId)) continue;
    byId.set(nutrientId, {
      nutrientId,
      labelIt: catalogId.replace(/_/g, " "),
      sourceText: `catalog:${catalogId}`,
      catalogId,
    });
  }
  return [...byId.values()].slice(0, 10);
}
