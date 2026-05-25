/** Tab integratori in Profilo → Nutrition Systems → Supplements. */
export type SupplementCategory = {
  id: string;
  label: string;
  items: string[];
};

/**
 * Etichette tab (UI): Aminosangue · Ergo · Micro
 * (non aminoacidi / ergogenici / micronutrienti).
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
    label: "Aminosangue",
    items: ["BCAA", "EAA", "Leucina", "Isoleucina", "Valina", "Glutammina", "Whey", "Caseina", "Proteine vegetali"],
  },
  {
    id: "ergo",
    label: "Ergo",
    items: ["Creatina", "Beta-Alanina", "Citrullina", "Caffeina", "Nitrati", "Taurina", "Rhodiola"],
  },
  {
    id: "micro",
    label: "Micro",
    items: ["Vitamina D", "Vitamina B12", "Vitamina C", "Ferro", "Zinco", "Magnesio bisglicinato", "Probiotici", "Enzimi digestivi"],
  },
];

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
