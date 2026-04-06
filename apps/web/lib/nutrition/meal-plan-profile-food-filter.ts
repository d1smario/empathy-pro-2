import type {
  IntelligentMealPlanFoodOptionRef,
  IntelligentMealPlanFunctionalFoodGroup,
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
} from "@/lib/nutrition/intelligent-meal-plan-types";

/** Frasi utente (intolleranza/allergia/esclusione) → sottostringhe da cercare nelle etichette. */
const PHRASE_TO_DENY_FRAGMENTS: Array<{ match: RegExp; fragments: string[] }> = [
  { match: /lattos|lactose|latteos|dairy|casein|caseina/i, fragments: [
      "latte", "lactose", "yogurt", "yoghurt", "ricotta", "mascarpone", "mozzarella",
      "parmigiano", "pecorino", "formaggio", "burro", "panna", "cream", "whey", "siero",
      "cottage", "kefir", "latticino",
    ] },
  { match: /glutin|gluten|celiac|celiaca|celiachia/i, fragments: [
      "glutine", "gluten", "grano", "wheat", "orzo", "barley", "segale", "rye", "farro",
      "spelt", "kamut", "triticale", "semola", "couscous", "bulgur", "frumento",
    ] },
  { match: /uov|egg|ovo/i, fragments: ["uov", "ovo", "album", "egg", "mayo", "maionese"] },
  { match: /arachid|peanut|groundnut/i, fragments: ["arachid", "peanut", "groundnut"] },
  { match: /frutta\s*a\s*guscio|tree\s*nut|nocciol|mandorl|noci\b|nocciole|pistacch|anacard|macadamia|pecan/i,
    fragments: ["mandorl", "nocciole", "noci", "pistacch", "anacard", "macadamia", "pecan", "noce "] },
  { match: /soia|soy|soja/i, fragments: ["soia", "soy", "soja", "tofu", "edamame", "miso"] },
  { match: /pesce|fish\b|ittic/i, fragments: ["pesce", "fish", "tonno", "salmone", "sgombro", "acciug", "merluzz", "gamber", "gambero", "calamar", "polpo", "cozze", "ostric"] },
  { match: /crostace|shellfish|mollusc/i, fragments: ["gamber", "aragost", "granchio", "cozze", "ostric", "calamar", "polpo"] },
  { match: /sesam|sesamo/i, fragments: ["sesam", "sesamo", "tahin"] },
  { match: /senap|mustard/i, fragments: ["senap", "mustard"] },
  { match: /sedan|celery|sedano/i, fragments: ["sedan", "celery", "sedano"] },
  { match: /lupin/i, fragments: ["lupin"] },
  { match: /mais|corn\b/i, fragments: ["mais", "corn", "cornmeal", "polenta"] },
];

const DIET_DENY: Record<string, string[]> = {
  vegan: [
    "pollo", "tacchino", "manzo", "maiale", "agnello", "prosciutto", "salame", "salsicc",
    "carne", "bresaola", "cotechino", "wurstel", "bacon", "pancetta",
    "pesce", "tonno", "salmone", "sgombro", "acciug", "merluzz", "gamber", "gambero",
    "calamar", "polpo", "cozze", "ostric",
    "uov", "ovo", "album",
    "latte", "yogurt", "yoghurt", "formaggio", "burro", "panna", "ricotta", "parmigiano",
    "mozzarella", "mascarpone", "pecorino", "whey", "cottage", "kefir",
    "miele", "honey", "gelatina", "gelatin",
  ],
  vegetarian: [
    "pollo", "tacchino", "manzo", "maiale", "agnello", "prosciutto", "salame", "salsicc",
    "carne", "bresaola", "cotechino", "wurstel", "bacon", "pancetta",
    "pesce", "tonno", "salmone", "sgombro", "acciug", "merluzz", "gamber", "gambero",
    "calamar", "polpo", "cozze", "ostric",
  ],
  pescatarian: [
    "pollo", "tacchino", "manzo", "maiale", "agnello", "prosciutto", "salame", "salsicc",
    "carne", "bresaola", "cotechino", "wurstel", "bacon", "pancetta",
  ],
};

function normalizePhrase(s: string): string {
  return s.trim().toLowerCase();
}

function collectFragmentsFromUserList(entries: string[] | null | undefined, out: Set<string>): void {
  for (const raw of entries ?? []) {
    const phrase = normalizePhrase(String(raw));
    if (phrase.length < 2) continue;
    out.add(phrase);
    for (const row of PHRASE_TO_DENY_FRAGMENTS) {
      if (row.match.test(phrase)) {
        for (const f of row.fragments) out.add(f);
      }
    }
  }
}

function dietDenyFragments(dietType: string | null | undefined): string[] {
  const d = normalizePhrase(dietType ?? "");
  if (!d || d === "omnivore" || d === "other") return [];
  if (d === "vegan") return [...DIET_DENY.vegan];
  if (d === "vegetarian") return [...DIET_DENY.vegetarian];
  if (d === "pescatarian") return [...DIET_DENY.pescatarian];
  if (d.includes("vegan")) return [...DIET_DENY.vegan];
  if (d.includes("veget")) return [...DIET_DENY.vegetarian];
  if (d.includes("pesc")) return [...DIET_DENY.pescatarian];
  return [];
}

/** Sottostringhe vietate (lowercase, lunghezza ≥ 2) da applicare a label + rationale opzioni. */
export function buildMealPlanFoodDenyFragments(req: IntelligentMealPlanRequest): string[] {
  const set = new Set<string>();
  collectFragmentsFromUserList(req.allergies ?? undefined, set);
  collectFragmentsFromUserList(req.intolerances ?? undefined, set);
  collectFragmentsFromUserList(req.foodExclusions ?? undefined, set);
  for (const f of dietDenyFragments(req.dietType)) set.add(f);
  return [...set].filter((s) => s.length >= 2);
}

function textMatchesDeny(text: string, fragments: string[]): boolean {
  const t = text.toLowerCase();
  return fragments.some((f) => t.includes(f));
}

function optionAllowed(o: IntelligentMealPlanFoodOptionRef, fragments: string[]): boolean {
  if (textMatchesDeny(o.label, fragments)) return false;
  if (o.rationale && textMatchesDeny(o.rationale, fragments)) return false;
  return true;
}

function filterGroup(g: IntelligentMealPlanFunctionalFoodGroup, fragments: string[]): IntelligentMealPlanFunctionalFoodGroup | null {
  const options = g.options.filter((o) => optionAllowed(o, fragments));
  if (options.length === 0) return null;
  return { ...g, options };
}

function filterSlot(slot: IntelligentMealPlanRequestSlot, fragments: string[]): IntelligentMealPlanRequestSlot {
  const groups = slot.functionalFoodGroups.map((g) => filterGroup(g, fragments)).filter((g): g is IntelligentMealPlanFunctionalFoodGroup => g != null);
  const nutrientIds = new Set(groups.map((g) => g.nutrientId));
  const functionalTargets = slot.functionalTargets.filter((t) => nutrientIds.has(t.nutrientId));
  const foodCandidates = slot.foodCandidates.filter((c) => !textMatchesDeny(c, fragments));
  return {
    ...slot,
    functionalFoodGroups: groups,
    functionalTargets,
    foodCandidates: [...new Set(foodCandidates)],
  };
}

/**
 * Rimuove opzioni/candidati che urtano allergie, intolleranze, esclusioni e tipo di dieta dichiarato.
 * Euristica per sottostringhe su etichette curate/USDA (non sostituisce validazione clinica).
 */
export function filterIntelligentMealPlanRequestFoods(req: IntelligentMealPlanRequest): IntelligentMealPlanRequest {
  const fragments = buildMealPlanFoodDenyFragments(req);
  if (fragments.length === 0) return req;
  return {
    ...req,
    slots: req.slots.map((s) => filterSlot(s, fragments)),
  };
}
