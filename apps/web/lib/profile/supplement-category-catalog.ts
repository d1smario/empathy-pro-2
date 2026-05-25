/** Tab integratori in Profilo → Nutrition Systems → Integratori. */
export type SupplementCategory = {
  id: string;
  label: string;
  items: string[];
};

/** Alias id tab → id canonico token (`amino`, `ergo`, `micro`). */
export const SUPPLEMENT_CATEGORY_LEGACY_IDS: Record<string, string> = {
  aminoacidi: "amino",
  aminoacido: "amino",
  aminosangue: "amino",
  ergogenici: "ergo",
  ergogenico: "ergo",
  micronutrienti: "micro",
  micronutriente: "micro",
};

/**
 * Etichette tab UI: Aminoacidi · Ergogenici · Micronutrienti.
 * Token salvati: `{id}:{item}` es. `amino:BCAA`.
 */
export const SUPPLEMENT_CATEGORIES: SupplementCategory[] = [
  {
    id: "carboidrati",
    label: "Carboidrati",
    items: ["Maltodestrina", "Fruttosio", "Glucosio", "Destrosio", "Vitargo", "Isomaltulosio", "Cluster Dextrin", "Mais ceroso"],
  },
  {
    id: "formati",
    label: "Formati",
    items: ["Gel", "Barrette", "Bevande", "Gommose", "Polvere", "Cibo Solido"],
  },
  {
    id: "elettro",
    label: "Elettroliti",
    items: ["Sodio", "Potassio", "Magnesio", "Calcio", "Cloruro", "Bicarbonato", "Mix elettroliti"],
  },
  {
    id: "amino",
    label: "Aminoacidi",
    items: ["BCAA", "EAA", "Leucina", "Isoleucina", "Valina", "Glutammina", "Whey", "Caseina", "Proteine vegetali"],
  },
  {
    id: "ergo",
    label: "Ergogenici",
    items: ["Creatina", "Beta-Alanina", "Citrullina", "Caffeina", "Nitrati", "Taurina", "Rhodiola"],
  },
  {
    id: "micro",
    label: "Micronutrienti",
    items: ["Vitamina D", "Vitamina B12", "Vitamina C", "Ferro", "Zinco", "Magnesio bisglicinato", "Probiotici", "Enzimi digestivi"],
  },
];

const CATEGORY_BY_ID = new Map(SUPPLEMENT_CATEGORIES.map((c) => [c.id, c]));

/** Normalizza id categoria (legacy → canonico). */
export function normalizeSupplementCategoryId(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (!key) return "carboidrati";
  return SUPPLEMENT_CATEGORY_LEGACY_IDS[key] ?? key;
}

export function findSupplementCategory(rawId: string): SupplementCategory | undefined {
  return CATEGORY_BY_ID.get(normalizeSupplementCategoryId(rawId));
}

export function getSupplementCategoryLabel(rawId: string): string {
  return findSupplementCategory(rawId)?.label ?? rawId;
}

/** Migra token `aminoacidi:BCAA` → `amino:BCAA` nel csv profilo. */
export function normalizeSupplementToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return "";
  const sep = trimmed.indexOf(":");
  if (sep <= 0) return trimmed;
  const prefix = trimmed.slice(0, sep);
  const item = trimmed.slice(sep + 1);
  return `${normalizeSupplementCategoryId(prefix)}:${item}`;
}

export function normalizeSupplementTokensCsv(csv: string): string {
  return csv
    .split(",")
    .map((t) => normalizeSupplementToken(t))
    .filter(Boolean)
    .join(", ");
}

export const SUPPLEMENT_BRANDS = [
  "Maurten",
  "SIS",
  "Precision Fuel & Hydration",
  "Neversecond",
  "Tailwind",
  "Skratch Labs",
  "Enervit",
  "Named Sport",
  "PowerBar",
  "Santa Madre",
  "4 Endurance",
  "HIGH5",
  "GU",
  "Clif",
  "Spring Energy",
  "Huma",
  "BPN",
  "Nuun",
  "SaltStick",
  "Thorne",
  "NOW Foods",
  "Pure Encapsulations",
  "Life Extension",
  "Jarrow",
  "Solgar",
  "Yamamoto",
  "Biotech USA",
  "Bulk",
  "MyProtein",
  "Optimum Nutrition",
  "Dymatize",
  "Scitec",
  "Applied Nutrition",
  "Kaged",
  "Transparent Labs",
  "Momentous",
  "NutriSport",
  "EthicSport",
  "KeForma",
  "Enforma",
] as const;
