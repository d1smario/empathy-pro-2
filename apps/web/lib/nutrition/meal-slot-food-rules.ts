import type {
  IntelligentMealPlanFoodOptionRef,
  IntelligentMealPlanFunctionalFoodGroup,
  IntelligentMealPlanRequest,
  IntelligentMealPlanRequestSlot,
  MealSlotKey,
} from "@/lib/nutrition/intelligent-meal-plan-types";

const LIGHT_SLOTS: ReadonlySet<MealSlotKey> = new Set(["breakfast", "snack_am", "snack_pm"]);

/**
 * Colazione / spuntino: niente “contorno” da pranzo (legumi, foglie, patate da forno, primi completi, ecc.).
 * Eccezioni esplicite sotto BREAKFAST_SNACK_ALLOW_FRAGMENTS.
 */
const BREAKFAST_SNACK_DENY_FRAGMENTS: string[] = [
  "lenticch",
  "lentil",
  "ceci",
  "chickpea",
  "fagiol",
  "bean",
  "beans",
  "pisell", // piselli
  "hummus",
  "cicerch",
  "legum",
  "black eyed",
  "spinaci",
  "spinach",
  "bietol",
  "chard",
  "cicoria",
  "chicory",
  "rucola",
  "arugula",
  "rocket",
  "cavolf",
  "broccol",
  "broccoli",
  "verza",
  "cavolo",
  "cabbage",
  "kale",
  "songino",
  "valerian",
  "patat",
  "potato",
  "barbabiet",
  "beetroot",
  "beet ",
  "pasta",
  "carbonara",
  "lasagn",
  "gnocch",
  "risotto",
  "raviol",
  "tortell",
  "cannellon",
  "couscous",
  "polenta",
  "melanz",
  "eggplant",
  "zucchin",
  "carciof",
  "artichoke",
  "verdure miste",
  "insalata verde",
  "peanut flour",
  // Pesce “da conserva / secondo” (colazione/spuntino: ok salmone/affumicato se in allow)
  "tonno",
  "tuna",
  "sgombro",
  "mackerel",
  "sardine",
  "sardina",
  "acciug",
  "anchov",
  "merluzz",
  "filetto di merluzz",
  // Carni da piatto principale (ok salumi in allow: bresaola, prosciutto, speck)
  "pollo",
  "chicken",
  "tacchino",
  "turkey",
  "petto di",
  "manzo",
  "beef",
  "maiale",
  "pork",
  "agnello",
  "lamb",
];

/** Se l’etichetta contiene uno di questi, non applicare deny (colazione/spuntino salati / classici). */
const BREAKFAST_SNACK_ALLOW_FRAGMENTS: string[] = [
  "bresaola",
  "prosciutto",
  "speck",
  "salame",
  "mortadella", // borderline snack
  "salmone",
  "salmon",
  "affumicat",
  "uov",
  "egg",
  "pane",
  "bread",
  "toast",
  "cereal",
  "avena",
  "oat",
  "muesli",
  "latte",
  "milk",
  "yogurt",
  "yoghurt",
  "ricotta",
  "cottage",
  "frutta",
  "fruit",
  "banana",
  "mela",
  "apple",
  "mirtill",
  "berry",
  "berries",
  "kiwi",
  "arancia",
  "orange",
  "mandorl",
  "almond",
  "cracker",
  "grissin",
  "burro",
  "marmellat",
  "jam",
  "honey",
  "miele",
  "whey",
  "proteina in polvere",
  "protein powder",
];

function labelLower(label: string): string {
  return label.trim().toLowerCase();
}

/** Colazione: niente olio d’oliva / olive come condimento (ok a pranzo/cena e in parte spuntino salato). */
const BREAKFAST_ONLY_DENY_FRAGMENTS: string[] = [
  "olio d'oliva",
  "olio d’oliva",
  "olio evo",
  "extra virgin",
  "olive ",
  "olives",
  "oliva da tavola",
];

export function isFoodLabelAllowedInMealSlot(label: string, slot: MealSlotKey): boolean {
  if (!LIGHT_SLOTS.has(slot)) return true;
  const t = labelLower(label);
  if (BREAKFAST_SNACK_ALLOW_FRAGMENTS.some((a) => t.includes(a))) return true;
  if (slot === "breakfast" && BREAKFAST_ONLY_DENY_FRAGMENTS.some((d) => t.includes(d))) return false;
  return !BREAKFAST_SNACK_DENY_FRAGMENTS.some((d) => t.includes(d));
}

export function filterFoodOptionRefsForMealSlot(options: IntelligentMealPlanFoodOptionRef[], slot: MealSlotKey): IntelligentMealPlanFoodOptionRef[] {
  return options.filter((o) => isFoodLabelAllowedInMealSlot(o.label, slot));
}

export function filterFunctionalFoodGroupsForMealSlot(
  groups: IntelligentMealPlanFunctionalFoodGroup[],
  slot: MealSlotKey,
): IntelligentMealPlanFunctionalFoodGroup[] {
  return groups
    .map((g) => {
      const options = filterFoodOptionRefsForMealSlot(g.options, slot);
      if (options.length === 0) return null;
      return { ...g, options };
    })
    .filter((g): g is IntelligentMealPlanFunctionalFoodGroup => g != null);
}

function filterMealPlanSlotRow(row: IntelligentMealPlanRequestSlot): IntelligentMealPlanRequestSlot {
  const groups = filterFunctionalFoodGroupsForMealSlot(row.functionalFoodGroups, row.slot);
  const nutrientIds = new Set(groups.map((g) => g.nutrientId));
  const functionalTargets = row.functionalTargets.filter((t) => nutrientIds.has(t.nutrientId));
  const foodCandidates = row.foodCandidates.filter((c) => isFoodLabelAllowedInMealSlot(c, row.slot));
  return {
    ...row,
    functionalFoodGroups: groups,
    functionalTargets,
    foodCandidates: [...new Set(foodCandidates)],
  };
}

export function applyMealSlotRulesToIntelligentMealPlanRequest(req: IntelligentMealPlanRequest): IntelligentMealPlanRequest {
  return {
    ...req,
    slots: req.slots.map((s) => filterMealPlanSlotRow(s)),
  };
}

/** Target funzionali del giorno senza gruppo alimentare coprente dopo i filtri (per integrazione). */
export function pathwayTargetsMissingFoodCoverage(
  pathwayTargets: Array<{ nutrientId: string; displayNameIt: string }>,
  groups: Array<{ nutrientId: string }>,
): Array<{ nutrientId: string; displayNameIt: string }> {
  const covered = new Set(groups.map((g) => g.nutrientId));
  return pathwayTargets.filter((t) => !covered.has(t.nutrientId));
}

const SUPPLEMENT_HINT_BY_NUTRIENT_PREFIX: Array<{ test: (id: string) => boolean; line: string }> = [
  {
    test: (id) => id.includes("folate") || id.includes("folic") || id === "folate_b9",
    line: "Integrazione (se concordata): acido folico o multivitaminico con B9 — a pranzo/cena copri con verdure a foglia e legumi.",
  },
  {
    test: (id) => id.includes("nitrate") || id.includes("dietary_nitrate"),
    line: "Nitrati dietetici: meglio a pranzo/cena (barbabietola / verdure); in colazione/spuntino valuta solo se prescritto.",
  },
  {
    test: (id) => id.includes("vitamin_c") || id.includes("ascorb"),
    line: "Vitamina C: agrumi o frutti di bosco a colazione/spuntino; altrimenti integrazione idrosolubile.",
  },
  {
    test: (id) => id.includes("leucine") || id.includes("mtor"),
    line: "Leucina: pasti principali (carne/pesce/latticini); a colazione/spuntino yogurt greco o whey se tollerati.",
  },
  {
    test: (id) => id.includes("magnesium") || id.includes("magnes"),
    line: "Magnesio: privilegia cena con verdure/semi; oppure magnesio (forma concordata) alla sera.",
  },
  {
    test: (id) => id.includes("niacin") || id.includes("b3"),
    line: "Niacina (B3): fonti dense a pranzo/cena; spuntino: oppure B-complex se indicato.",
  },
  {
    test: (id) => id.includes("potassium") || id.includes("potass"),
    line: "Potassio: banana/yogurt a colazione; patate e legumi solo pranzo/cena.",
  },
  {
    test: (id) => id.includes("zinc") || id.includes("selen") || id.includes("seleno"),
    line: "Zinco/selenio: pasti principali (carne, pesce, frutta secca controllata); oppure integrazione mirata.",
  },
  {
    test: (id) => id.includes("thiamine") || id.includes("b1"),
    line: "Tiamina (B1): cereali integrali a colazione; completezza a pranzo/cena.",
  },
  {
    test: (id) => id.includes("glutamine") || id.includes("glutammina"),
    line: "Glutammina alimentare: brodo/cottage a pasti adatti; non forzare in colazione leggera.",
  },
  {
    test: (id) => id.includes("omega") || id.includes("epa") || id.includes("dha"),
    line: "Omega-3 EPA/DHA: pesce a pranzo/cena; a colazione solo salmone/affumicati se previsto; altrimenti integrazione.",
  },
];

export function supplementHintLinesForUncoveredTargets(
  slot: MealSlotKey,
  uncovered: Array<{ nutrientId: string; displayNameIt: string }>,
  maxLines = 3,
): string[] {
  if (!LIGHT_SLOTS.has(slot) || uncovered.length === 0) return [];
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const t of uncovered) {
    const row = SUPPLEMENT_HINT_BY_NUTRIENT_PREFIX.find((r) => r.test(t.nutrientId));
    if (row && !seen.has(row.line)) {
      seen.add(row.line);
      lines.push(row.line);
    }
    if (lines.length >= maxLines) break;
  }
  return lines;
}

const FISH_CANNEDISH_FRAGMENTS = ["tonno", "tuna", "sgombro", "mackerel", "sardine", "sardina", "acciug", "anchov", "merluzz", "cod "];
const NUT_FRAGMENTS = ["arachid", "peanut", "nocciol", "noci ", "noci,", "mandorl", "pistacch", "noce ", "walnut"];

function lineMatchesAny(line: string, frags: string[]): boolean {
  const l = line.toLowerCase();
  return frags.some((f) => l.includes(f));
}

/** Spuntino: evita abbinamenti tipo tonno + arachidi (stesso elenco). */
export function pruneSnackDryLineConflicts(lines: string[]): string[] {
  const hasFish = lines.some((ln) => lineMatchesAny(ln, FISH_CANNEDISH_FRAGMENTS));
  const hasNuts = lines.some((ln) => lineMatchesAny(ln, NUT_FRAGMENTS));
  if (!hasFish || !hasNuts) return lines;
  const withoutNuts = lines.filter((ln) => !lineMatchesAny(ln, NUT_FRAGMENTS));
  return withoutNuts.length > 0 ? withoutNuts : lines.filter((ln) => !lineMatchesAny(ln, FISH_CANNEDISH_FRAGMENTS));
}
