/**
 * Ontology `cofactorNutrientTags` → stringhe cofactor italiane consumate da
 * `pathway-cofactors-to-nutrient-targets` (regex deterministiche).
 */
const TAG_TO_COFACTOR_STRING: Record<string, string> = {
  thiamine: "Tiamina (B1)",
  b_vitamins: "Vitamine B1/B3 (utilizzo CHO)",
  magnesium: "Magnesio (chinasi)",
  iron: "Ferro eme/non eme",
  vitamin_c: "Vitamina C",
  zinc: "Zinco",
  omega3_context: "Omega-3 (EPA/DHA)",
  polyphenols_context: "Polifenoli alimentari",
  sulfur_compounds: "Composti solforati alimentari",
  selenium: "Selenio",
  folate_context: "Folati (B9)",
  b12_context: "Vitamina B12",
  iodine: "Iodio alimentare",
  carnitine_context: "Carnitina (contesto ossidazione FA)",
  coq10_context: "CoQ10 (contesto mitocondriale)",
  nad_precursors_context: "Precursori NAD+ (contesto sirtuine)",
  lipoate_context: "Acido lipoico (contesto PDH)",
  leucine_context: "Leucina (contesto mTOR)",
  cho_timing: "CHO ad alta disponibilità peri-stimolo",
  copper_context: "Rame (contesto catena respiratoria)",
};

function uniq(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

/** Risolve tag ontologia multiscala in stringhe cofactor per pathway / meal plan. */
export function resolveMultiscaleTagsToCofactorStrings(tags: readonly string[]): string[] {
  const out: string[] = [];
  for (const tag of tags) {
    const mapped = TAG_TO_COFACTOR_STRING[tag.trim()];
    if (mapped) out.push(mapped);
  }
  return uniq(out);
}

/** Lookup singolo tag (test / debug). */
export function multiscaleTagToCofactorString(tag: string): string | null {
  return TAG_TO_COFACTOR_STRING[tag.trim()] ?? null;
}
