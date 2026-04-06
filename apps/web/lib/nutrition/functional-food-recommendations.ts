import type {
  FunctionalFoodRecommendationsViewModel,
  FunctionalFoodTargetViewModel,
  NutritionPathwaySupportItem,
  UsdaRichFoodSearchSpecViewModel,
} from "@/api/nutrition/contracts";

const USDA_COMPOSITION_TYPES: UsdaRichFoodSearchSpecViewModel["dataTypes"] = ["Foundation", "SR Legacy"];

export type FunctionalNutrientCatalogEntry = {
  id: string;
  kind: FunctionalFoodTargetViewModel["kind"];
  displayNameIt: string;
  /** Pathway ids from builder (e.g. glycogen_resynthesis). */
  pathwayIds: string[];
  /** Match if this substring appears in substrates/cofactors (lowercase). */
  textHints: string[];
  /** Queries for `/api/nutrition/food-lookup` (OpenFoodFacts + USDA branded). */
  searchQueries: string[];
  rationaleIt: string;
  curatedExamples: Array<{ name: string; why: string }>;
  /** POST FDC search: min nutrient / 100 g + queries (Foundation + SR Legacy). */
  usdaRichSearch?: UsdaRichFoodSearchSpecViewModel;
};

export function getFunctionalNutrientCatalogEntry(id: string): FunctionalNutrientCatalogEntry | undefined {
  return FUNCTIONAL_NUTRIENT_CATALOG.find((e) => e.id === id);
}

/**
 * Curated nutrient → food bridge. Extend over time; lookup API enriches with live DB rows.
 */
export const FUNCTIONAL_NUTRIENT_CATALOG: FunctionalNutrientCatalogEntry[] = [
  {
    id: "leucine_mtor",
    kind: "amino_acid",
    displayNameIt: "Leucina (segnale mTOR / sintesi proteica)",
    pathwayIds: ["glycogen_resynthesis"],
    textHints: ["leucina", "leucine", "bcaa", "eaa", "proteina", "protein"],
    searchQueries: ["greek yogurt high protein", "cottage cheese", "whey protein powder", "chicken breast"],
    usdaRichSearch: {
      fdcNutrientId: 1213,
      nutrientShortLabel: "Leucina (mg/100 g)",
      minimumPer100g: 1200,
      queries: ["chicken breast", "beef sirloin", "tuna", "parmesan cheese", "pumpkin seeds"],
      dataTypes: USDA_COMPOSITION_TYPES,
    },
    rationaleIt:
      "Dopo stimolo glicolitico/intenso, la leucina nella finestra 0–2 h supporta sintesi proteica accoppiata al ripristino glicogeno.",
    curatedExamples: [
      { name: "Yogurt greco (0%–2%)", why: "Alta densità proteica, leucina in quantità rilevante per porzione." },
      { name: "Petto di pollo / tacchino", why: "Proteine complete; timing post-workout classico." },
      { name: "Latte scremato + cereali", why: "Leucina + CHO nella stessa finestra (insulina + mTOR)." },
    ],
  },
  {
    id: "magnesium_kinase",
    kind: "mineral",
    displayNameIt: "Magnesio (cofattore chinasi / elettroliti)",
    pathwayIds: ["glycogen_resynthesis", "mitochondrial_redox_support", "gut_absorption_barrier"],
    textHints: ["magnesio", "magnesium", "mg "],
    searchQueries: ["pumpkin seeds", "almonds magnesium", "dark chocolate 85", "spinach frozen"],
    usdaRichSearch: {
      fdcNutrientId: 1090,
      nutrientShortLabel: "Magnesio (mg/100 g)",
      minimumPer100g: 50,
      queries: ["pumpkin seeds", "spinach", "almond", "black bean", "dark chocolate"],
      dataTypes: USDA_COMPOSITION_TYPES,
    },
    rationaleIt:
      "Cofattore per reazioni fosfotransferasi; utile in giornate ad alto turnover energetico e sudorazione.",
    curatedExamples: [
      { name: "Semi di zucca", why: "Tra gli alimenti più densi di Mg in porzioni pratiche." },
      { name: "Mandorle / noci", why: "Mg + grassi buoni; lontano solo dalla finestra pre-sprint se sensibilità GI." },
      { name: "Cioccolato fondente 85%", why: "Mg e polifenoli; porzione controllata." },
    ],
  },
  {
    id: "thiamine_b1",
    kind: "vitamin",
    displayNameIt: "Vitamina B1 (tiamina, catabolismo CHO)",
    pathwayIds: ["glycogen_resynthesis", "mitochondrial_redox_support"],
    textHints: ["b1", "tiamina", "thiamin", "vitamina b"],
    searchQueries: ["pork tenderloin", "legumes lentils", "whole grain bread"],
    usdaRichSearch: {
      fdcNutrientId: 1165,
      nutrientShortLabel: "Tiamina (mg/100 g)",
      minimumPer100g: 0.12,
      queries: ["pork", "lentils", "rice brown", "peas green"],
      dataTypes: USDA_COMPOSITION_TYPES,
    },
    rationaleIt: "Ruolo in decarbossilazioni del piruvato; coerente con alto carico glucidico cronico o sedute lunghe.",
    curatedExamples: [
      { name: "Maiale magro / prosciutto crudo (porzione)", why: "Fonte alimentare classica di tiamina." },
      { name: "Legumi (lenticchie, ceci)", why: "B1 + fibra lontano dalla finestra immediatamente pre-intensa." },
    ],
  },
  {
    id: "niacin_b3",
    kind: "vitamin",
    displayNameIt: "Vitamina B3 (niacina, NAD/NADH)",
    pathwayIds: ["mitochondrial_redox_support"],
    textHints: ["b3", "niacin", "niacina", "nad"],
    searchQueries: ["tuna canned", "chicken breast", "peanuts roasted"],
    usdaRichSearch: {
      fdcNutrientId: 1167,
      nutrientShortLabel: "Niacina (mg/100 g)",
      minimumPer100g: 4,
      queries: ["tuna", "turkey", "peanut", "mushroom"],
      dataTypes: USDA_COMPOSITION_TYPES,
    },
    rationaleIt: "Precursore NAD; si collega al supporto della catena mitocondriale in contesti di stress redox moderato.",
    curatedExamples: [
      { name: "Tonno / sgombro", why: "B3 + omega-3 (sinergia parziale con asse redox)." },
      { name: "Arachidi", why: "B3 concentrato; attenzione calorica." },
    ],
  },
  {
    id: "vitamin_c_redox",
    kind: "vitamin",
    displayNameIt: "Vitamina C (acido ascorbico, redox)",
    pathwayIds: ["mitochondrial_redox_support"],
    textHints: ["vitamina c", "vitamin c", "ascorb", "polifen"],
    searchQueries: ["kiwi fruit", "red pepper sweet", "orange juice"],
    usdaRichSearch: {
      fdcNutrientId: 1162,
      nutrientShortLabel: "Vitamina C (mg/100 g)",
      minimumPer100g: 25,
      queries: ["pepper sweet red", "kiwi", "orange", "strawberry", "broccoli"],
      dataTypes: USDA_COMPOSITION_TYPES,
    },
    rationaleIt: "Antioxidante idrosolubile; supporta difese redox alimentari (non sostituisce recupero o carico).",
    curatedExamples: [
      { name: "Kiwi / agrumi", why: "Vit C + carboidrati semplici in spuntino." },
      { name: "Peperone rosso crudo", why: "Molto alto in vit C per 100 g." },
    ],
  },
  {
    id: "folate_b9",
    kind: "vitamin",
    displayNameIt: "Folati (B9, sintesi nucleotidi / turnover cellulare)",
    pathwayIds: ["glycogen_resynthesis", "mitochondrial_redox_support", "gut_absorption_barrier"],
    textHints: ["folat", "folate", "b9", "acido folico", "tetraidrofol", "methyl"],
    searchQueries: ["spinach cooked", "lentils cooked", "asparagus", "romaine lettuce"],
    usdaRichSearch: {
      fdcNutrientId: 1186,
      nutrientShortLabel: "Folato, food (µg/100 g)",
      minimumPer100g: 40,
      queries: ["spinach", "lentils", "asparagus", "black eyed peas", "romaine"],
      dataTypes: USDA_COMPOSITION_TYPES,
    },
    rationaleIt:
      "I folati supportano sintesi di nucleotidi e riparazione; dopo volumi o stimoli con alto turnover, privilegiare verdure a foglia e legumi rispetto a ortaggi meno densi.",
    curatedExamples: [
      {
        name: "Spinaci / bietole / cicoria",
        why: "Molto ricchi di folati: spesso più utili del cavolo a parità di porzione per copertura B9.",
      },
      { name: "Lenticchie / ceci cotti", why: "Folati + amidi in un pasto principale; utili fuori dalla sola foglia verde." },
    ],
  },
  {
    id: "dietary_nitrate",
    kind: "other",
    displayNameIt: "Nitrati dietetici (via NO / perfusione)",
    pathwayIds: ["mitochondrial_redox_support", "glycogen_resynthesis"],
    textHints: ["nitrato", "nitrate", "beet", "barbabietol"],
    searchQueries: ["beetroot juice", "spinach fresh", "rocket arugula"],
    rationaleIt:
      "Verdure ricche di nitrato possono supportare la biologia del NO; timing tipicamente lontano dall’intensità massima se sensibilità GI.",
    curatedExamples: [
      { name: "Succo barbabietola (porzione)", why: "Concentrato di nitrati; testare tolleranza." },
      { name: "Rucola / spinaci", why: "Nitrati con pasto quotidiano." },
    ],
  },
  {
    id: "omega3_epa_dha",
    kind: "fatty_acid",
    displayNameIt: "Omega-3 EPA/DHA",
    pathwayIds: ["mitochondrial_redox_support", "gut_absorption_barrier"],
    textHints: ["omega", "epa", "dha", "pesce azzurro", "fatty fish"],
    searchQueries: ["salmon atlantic", "mackerel canned", "sardines in olive oil"],
    rationaleIt: "Lipidi di membrana e modulazione infiammatoria di base; integrazione alimentare prima che integratore.",
    curatedExamples: [
      { name: "Salmone / sgombro / alici", why: "Fonti alimentari dirette EPA/DHA." },
      { name: "Semi di lino macinati (ALA)", why: "Precursore vegetale; conversione limitata ma utile in dieta plant-based." },
    ],
  },
  {
    id: "zinc_seleno",
    kind: "mineral",
    displayNameIt: "Zinco e selenio (cofattori redox / immunità)",
    pathwayIds: ["mitochondrial_redox_support"],
    textHints: ["zinco", "zinc", "selenio", "selenium"],
    searchQueries: ["oysters canned", "beef lean", "brazil nuts"],
    usdaRichSearch: {
      fdcNutrientId: 1095,
      nutrientShortLabel: "Zinco (mg/100 g) — selenio: usa ricerca separata o arachidi/noci Brasile",
      minimumPer100g: 1.5,
      queries: ["oyster", "beef", "lamb", "pumpkin seeds", "hemp seeds"],
      dataTypes: USDA_COMPOSITION_TYPES,
    },
    rationaleIt: "Cofattori enzimi redox; densità variabile — porzioni e frequenza da personalizzare.",
    curatedExamples: [
      { name: "Frutti di mare (ostriche)", why: "Zinco molto concentrato." },
      { name: "Noci del Brasile", why: "Selenio; 1–2 noci possono coprire buona parte del fabbisogno." },
    ],
  },
  {
    id: "potassium_foods",
    kind: "mineral",
    displayNameIt: "Potassio (equilibrio elettrolitico con sodio)",
    pathwayIds: ["glycogen_resynthesis", "gut_absorption_barrier"],
    textHints: ["potassio", "potassium", "k ", "elettrolit"],
    searchQueries: ["banana", "potato baked", "white beans canned"],
    usdaRichSearch: {
      fdcNutrientId: 1092,
      nutrientShortLabel: "Potassio (mg/100 g)",
      minimumPer100g: 300,
      queries: ["potato", "banana", "white beans", "spinach", "avocado"],
      dataTypes: USDA_COMPOSITION_TYPES,
    },
    rationaleIt: "Supporta volume e contrazione; sinergia con idratazione e sodio peri-workout.",
    curatedExamples: [
      { name: "Patata / patata dolce al forno", why: "K + amido per ricarica." },
      { name: "Banana matura", why: "K + CHO rapidi in recovery." },
    ],
  },
  {
    id: "glutamine_food",
    kind: "amino_acid",
    displayNameIt: "Glutammina (alimenti, barriera / recovery)",
    pathwayIds: ["gut_absorption_barrier"],
    textHints: ["glutammina", "glutamine", "collagen"],
    searchQueries: ["bone broth", "cottage cheese", "cabbage sauerkraut"],
    rationaleIt: "Precursore per enterociti in contesti di stress GI; preferire alimenti prima di polveri ad alto dosaggio.",
    curatedExamples: [
      { name: "Brodo di ossa (lungo)", why: "Glicina/prolina/glutammina in mix naturale." },
      { name: "Cavolo / crauti (se tollerati)", why: "Fermentati — attenzione a timing se sensibilità." },
    ],
  },
];

function textBlob(pw: NutritionPathwaySupportItem): string {
  return `${pw.pathwayLabel} ${pw.substrates.join(" ")} ${pw.cofactors.join(" ")}`.toLowerCase();
}

function pickTargetsForPathway(pw: NutritionPathwaySupportItem): FunctionalNutrientCatalogEntry[] {
  const out: FunctionalNutrientCatalogEntry[] = [];
  const blob = textBlob(pw);
  for (const entry of FUNCTIONAL_NUTRIENT_CATALOG) {
    if (entry.pathwayIds.includes(pw.id)) {
      out.push(entry);
      continue;
    }
    if (entry.textHints.some((h) => blob.includes(h.toLowerCase()))) {
      out.push(entry);
    }
  }
  return out;
}

function dedupeEntries(entries: FunctionalNutrientCatalogEntry[]): FunctionalNutrientCatalogEntry[] {
  const seen = new Set<string>();
  const out: FunctionalNutrientCatalogEntry[] = [];
  for (const e of entries) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

/** Micro-target USDA-backed quando non ci sono vie da sessione (stesso catalogo deterministico). */
const QUIET_DAY_CATALOG_IDS: string[] = [
  "folate_b9",
  "leucine_mtor",
  "magnesium_kinase",
  "niacin_b3",
  "thiamine_b1",
  "vitamin_c_redox",
  "potassium_foods",
  "zinc_seleno",
];

function catalogEntryToQuietDayTarget(e: FunctionalNutrientCatalogEntry): FunctionalFoodTargetViewModel {
  return {
    nutrientId: e.id,
    kind: e.kind,
    displayNameIt: e.displayNameIt,
    rationaleIt: e.rationaleIt,
    pathwayIds: ["quiet_day_default"],
    pathwayLabel: "Supporto quotidiano (nessuna seduta sul giorno nel contesto modulo)",
    searchQueries: [...e.searchQueries],
    curatedExamples: [...e.curatedExamples],
    usdaRichSearch: e.usdaRichSearch ? { ...e.usdaRichSearch } : null,
  };
}

function buildQuietDayDefaultTargets(): FunctionalFoodTargetViewModel[] {
  const out: FunctionalFoodTargetViewModel[] = [];
  for (const id of QUIET_DAY_CATALOG_IDS) {
    const e = FUNCTIONAL_NUTRIENT_CATALOG.find((c) => c.id === id);
    if (!e?.usdaRichSearch) continue;
    out.push(catalogEntryToQuietDayTarget(e));
  }
  return out;
}

/**
 * Maps active pathway contexts to concrete nutrient targets + food search queries + curated whole-food examples.
 */
export function buildFunctionalFoodRecommendationsViewModel(
  pathways: NutritionPathwaySupportItem[] | null | undefined,
): FunctionalFoodRecommendationsViewModel {
  const list = pathways ?? [];
  if (!list.length) {
    const targets = buildQuietDayDefaultTargets();
    return {
      modelVersion: 1,
      layer: "deterministic_food_bridge",
      targets,
      notes: [
        "Giorno senza vie modulate da sessione pianificata: target da catalogo EMPATHY (supporto quotidiano + USDA per densità). Aggiungi una seduta nel calendario per affinare i target al builder.",
        "Rispetta allergie ed esclusioni del profilo prima di scegliere alimenti dalla lista.",
      ],
    };
  }

  const byNutrient = new Map<string, FunctionalFoodTargetViewModel>();

  for (const pw of list) {
    const entries = dedupeEntries(pickTargetsForPathway(pw));
    for (const e of entries) {
      const prev = byNutrient.get(e.id);
      if (!prev) {
        byNutrient.set(e.id, {
          nutrientId: e.id,
          kind: e.kind,
          displayNameIt: e.displayNameIt,
          rationaleIt: e.rationaleIt,
          pathwayIds: [pw.id],
          pathwayLabel: pw.pathwayLabel,
          searchQueries: [...e.searchQueries],
          curatedExamples: [...e.curatedExamples],
          usdaRichSearch: e.usdaRichSearch ? { ...e.usdaRichSearch } : null,
        });
      } else {
        if (!prev.pathwayIds.includes(pw.id)) prev.pathwayIds.push(pw.id);
        prev.pathwayLabel = uniqLabels(prev.pathwayLabel, pw.pathwayLabel);
        if (!prev.usdaRichSearch && e.usdaRichSearch) prev.usdaRichSearch = { ...e.usdaRichSearch };
      }
    }
  }

  return {
    modelVersion: 1,
    layer: "deterministic_food_bridge",
    targets: Array.from(byNutrient.values()),
    notes: [
      "Esempi alimentari curati nel catalogo EMPATHY; ricerca prodotti (OFF/branded) e, con USDA_API_KEY, elenco Foundation/SR ordinato per densità del nutriente FDC.",
      "Rispetta allergie/esclusioni del profilo prima di scegliere alimenti dalla lista.",
    ],
  };
}

function uniqLabels(a: string, b: string): string {
  const parts = new Set(
    `${a}; ${b}`
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return Array.from(parts).join("; ");
}
