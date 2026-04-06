export type FuelingCategory = "recovery" | "drink" | "gel" | "bar" | "chew";

export type FuelingFormat =
  | "powder"
  | "gel"
  | "bar"
  | "chew"
  | "drink"
  | "capsule"
  | "tablet"
  | "gummies"
  | "sachet";

export type FuelingFunctionalFocus =
  | "carbo"
  | "electrolyte"
  | "preworkout"
  | "recovery"
  | "protein"
  | "eaa"
  | "bcaa"
  | "caffeine"
  | "creatine";

export type FuelingTiming = "pre" | "intra" | "post" | "daily";

export type FuelingProduct = {
  brand: string;
  product: string;
  category: FuelingCategory;
  productUrl: string;
  logoDomain: string;
  imageUrl?: string;
  format: FuelingFormat;
  functionalFocus: FuelingFunctionalFocus[];
  timing: FuelingTiming[];
};

function toFuelingKeyPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function buildFuelingBrandCategoryKey(brand: string, category: FuelingCategory) {
  return `${toFuelingKeyPart(brand)}_${category}`;
}

export function buildFuelingProductKey(product: Pick<FuelingProduct, "brand" | "product">) {
  return `${toFuelingKeyPart(product.brand)}__${toFuelingKeyPart(product.product)}`;
}

export function buildFuelingMediaKeyCandidates(product: FuelingProduct | undefined, category: FuelingCategory) {
  return [
    product ? buildFuelingProductKey(product) : null,
    product ? buildFuelingBrandCategoryKey(product.brand, category) : null,
    category,
  ].filter((value): value is string => Boolean(value));
}

export const FUELING_PRODUCT_CATALOG: FuelingProduct[] = [
  { brand: "Enervit", product: "R2 Recovery Drink", category: "recovery", productUrl: "https://www.enervit.com/en/wp-recovery-drink.html", logoDomain: "enervit.com", format: "powder", functionalFocus: ["recovery", "protein", "carbo"], timing: ["post"] },
  { brand: "Enervit", product: "C2:1PRO Gel", category: "gel", productUrl: "https://www.enervit.com/en/products/the-carbo-gel-c-2-1-pro-orange.html", logoDomain: "enervit.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"] },
  {
    brand: "Enervit",
    product: "Isocarb C2:1PRO",
    category: "drink",
    productUrl: "https://www.enervit.com/en/products/isocarb-c-2-1-pro.html",
    logoDomain: "enervit.com",
    imageUrl: "https://enervit.kleecks-cdn.com/media/catalog/product/b/u/busta-isocarb-lemon-786x818_con_ombra.jpg",
    format: "powder",
    functionalFocus: ["carbo", "electrolyte"],
    timing: ["pre", "intra"],
  },
  { brand: "Enervit", product: "Competition Bar", category: "bar", productUrl: "https://www.enervit.com/en/competition-bar-orange.html", logoDomain: "enervit.com", format: "bar", functionalFocus: ["carbo"], timing: ["pre", "intra"] },
  { brand: "Enervit", product: "Pre Sport", category: "drink", productUrl: "https://www.enervit.com", logoDomain: "enervit.com", format: "powder", functionalFocus: ["preworkout", "caffeine"], timing: ["pre"] },
  { brand: "Enervit", product: "Whey Protein", category: "recovery", productUrl: "https://www.enervit.com", logoDomain: "enervit.com", format: "powder", functionalFocus: ["protein", "recovery"], timing: ["post", "daily"] },
  { brand: "Enervit", product: "EAA Amino Mix", category: "drink", productUrl: "https://www.enervit.com", logoDomain: "enervit.com", format: "powder", functionalFocus: ["eaa", "recovery"], timing: ["post", "daily"] },
  { brand: "Enervit", product: "BCAA 2:1:1", category: "chew", productUrl: "https://www.enervit.com", logoDomain: "enervit.com", format: "tablet", functionalFocus: ["bcaa", "recovery"], timing: ["pre", "post", "daily"] },

  { brand: "Maurten", product: "Drink Mix 160", category: "drink", productUrl: "https://www.maurten.com/products/drink-mix-160-box", logoDomain: "maurten.com", format: "powder", functionalFocus: ["carbo"], timing: ["pre", "intra"] },
  { brand: "Maurten", product: "Gel 100", category: "gel", productUrl: "https://www.maurten.com/products/hr/gel-100-box", logoDomain: "maurten.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"] },
  { brand: "Maurten", product: "Gel 100 Caf 100", category: "chew", productUrl: "https://www.maurten.com/products/hr/gel-100-caf-100-box", logoDomain: "maurten.com", format: "gel", functionalFocus: ["carbo", "caffeine"], timing: ["pre", "intra"] },
  { brand: "Maurten", product: "Drink Mix 320", category: "drink", productUrl: "https://www.maurten.com", logoDomain: "maurten.com", format: "powder", functionalFocus: ["carbo"], timing: ["intra"] },
  { brand: "Maurten", product: "Solid 160", category: "bar", productUrl: "https://www.maurten.com", logoDomain: "maurten.com", format: "bar", functionalFocus: ["carbo"], timing: ["pre", "intra"] },

  { brand: "SiS", product: "REGO Rapid Recovery", category: "recovery", productUrl: "https://www.scienceinsport.com/shop-sis/rego-range/rapid-recovery-1kg", logoDomain: "scienceinsport.com", format: "powder", functionalFocus: ["recovery", "protein", "carbo"], timing: ["post"] },
  { brand: "SiS", product: "GO Isotonic Gel", category: "gel", productUrl: "https://www.scienceinsport.com/shop-sis/go-range/go-isotonic-energy-gel", logoDomain: "scienceinsport.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"] },
  { brand: "SiS", product: "Beta Fuel Drink", category: "drink", productUrl: "https://www.scienceinsport.com/shop-sis/beta-fuel-range/beta-fuel-energy-drink", logoDomain: "scienceinsport.com", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["intra"] },
  { brand: "SiS", product: "GO Energy Bar", category: "bar", productUrl: "https://www.scienceinsport.com/shop-sis/go-range/go-energy-bar", logoDomain: "scienceinsport.com", format: "bar", functionalFocus: ["carbo"], timing: ["pre", "intra"] },
  { brand: "SiS", product: "GO Electrolyte", category: "drink", productUrl: "https://www.scienceinsport.com", logoDomain: "scienceinsport.com", format: "powder", functionalFocus: ["electrolyte"], timing: ["pre", "intra"] },
  { brand: "SiS", product: "GO Caffeine Gel", category: "gel", productUrl: "https://www.scienceinsport.com", logoDomain: "scienceinsport.com", format: "gel", functionalFocus: ["carbo", "caffeine"], timing: ["pre", "intra"] },
  { brand: "SiS", product: "Beta Fuel Chew", category: "chew", productUrl: "https://www.scienceinsport.com", logoDomain: "scienceinsport.com", format: "chew", functionalFocus: ["carbo"], timing: ["intra"] },
  { brand: "SiS", product: "BCAA Performance", category: "drink", productUrl: "https://www.scienceinsport.com", logoDomain: "scienceinsport.com", format: "powder", functionalFocus: ["bcaa", "recovery"], timing: ["post", "daily"] },

  { brand: "+Watt", product: "R.M. Pump Recovery Mix", category: "recovery", productUrl: "https://watt.it/en/post-workout-en/r-m-pump-recovery-mix/", logoDomain: "watt.it", format: "powder", functionalFocus: ["recovery", "protein", "carbo"], timing: ["post"] },
  { brand: "+Watt", product: "Energy Gel", category: "gel", productUrl: "https://watt.it", logoDomain: "watt.it", format: "gel", functionalFocus: ["carbo"], timing: ["intra"] },
  { brand: "+Watt", product: "Carbo Drink", category: "drink", productUrl: "https://watt.it", logoDomain: "watt.it", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["pre", "intra"] },
  { brand: "+Watt", product: "Pre Workout Nitro Pump", category: "drink", productUrl: "https://watt.it", logoDomain: "watt.it", format: "powder", functionalFocus: ["preworkout", "caffeine"], timing: ["pre"] },
  { brand: "+Watt", product: "Whey Isolate", category: "recovery", productUrl: "https://watt.it", logoDomain: "watt.it", format: "powder", functionalFocus: ["protein", "recovery"], timing: ["post", "daily"] },
  { brand: "+Watt", product: "EAA Zero", category: "drink", productUrl: "https://watt.it", logoDomain: "watt.it", format: "powder", functionalFocus: ["eaa", "recovery"], timing: ["post", "daily"] },
  { brand: "+Watt", product: "BCAA 4:1:1", category: "chew", productUrl: "https://watt.it", logoDomain: "watt.it", format: "tablet", functionalFocus: ["bcaa"], timing: ["pre", "post", "daily"] },
  { brand: "+Watt", product: "Creatine Powder", category: "drink", productUrl: "https://watt.it", logoDomain: "watt.it", format: "powder", functionalFocus: ["creatine"], timing: ["daily", "post"] },

  { brand: "Powerbar", product: "Recovery Max", category: "recovery", productUrl: "https://www.powerbar.com/en-gb/products/recovery-max-regeneration-whey-drink-with-carbohydrates", logoDomain: "powerbar.com", format: "powder", functionalFocus: ["recovery", "protein", "carbo"], timing: ["post"] },
  { brand: "Powerbar", product: "PowerGel Hydro", category: "gel", productUrl: "https://www.powerbar.com", logoDomain: "powerbar.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"] },
  { brand: "Powerbar", product: "IsoActive Drink", category: "drink", productUrl: "https://www.powerbar.com/en-gb/products/isoactive-isotonic-sports-drink", logoDomain: "powerbar.com", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["pre", "intra"] },
  { brand: "Powerbar", product: "Energize Original", category: "bar", productUrl: "https://www.powerbar.com", logoDomain: "powerbar.com", format: "bar", functionalFocus: ["carbo"], timing: ["pre", "intra"] },
  { brand: "Powerbar", product: "Black Line Pre-Workout", category: "drink", productUrl: "https://www.powerbar.com", logoDomain: "powerbar.com", format: "powder", functionalFocus: ["preworkout", "caffeine"], timing: ["pre"] },
  { brand: "Powerbar", product: "Protein Plus", category: "recovery", productUrl: "https://www.powerbar.com", logoDomain: "powerbar.com", format: "bar", functionalFocus: ["protein", "recovery"], timing: ["post", "daily"] },

  { brand: "Precision Fuel & Hydration", product: "PF 30 Gel", category: "gel", productUrl: "https://www.precisionhydration.com", logoDomain: "precisionhydration.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"] },
  { brand: "Precision Fuel & Hydration", product: "Carb & Electrolyte Drink Mix", category: "drink", productUrl: "https://www.precisionhydration.com", logoDomain: "precisionhydration.com", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["pre", "intra"] },
  { brand: "Precision Fuel & Hydration", product: "PH 1000", category: "drink", productUrl: "https://www.precisionhydration.com", logoDomain: "precisionhydration.com", format: "tablet", functionalFocus: ["electrolyte"], timing: ["pre", "intra", "daily"] },
  { brand: "Precision Fuel & Hydration", product: "PF Chew", category: "chew", productUrl: "https://www.precisionhydration.com", logoDomain: "precisionhydration.com", format: "chew", functionalFocus: ["carbo"], timing: ["intra"] },

  { brand: "Named Sport", product: "Race Fuel", category: "drink", productUrl: "https://www.namedsport.com", logoDomain: "namedsport.com", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["pre", "intra"] },
  { brand: "Named Sport", product: "Total Energy Hydro Gel", category: "gel", productUrl: "https://www.namedsport.com", logoDomain: "namedsport.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"] },
  { brand: "Named Sport", product: "Whey Isolate", category: "recovery", productUrl: "https://www.namedsport.com", logoDomain: "namedsport.com", format: "powder", functionalFocus: ["protein", "recovery"], timing: ["post", "daily"] },
  { brand: "Named Sport", product: "BCAA Powder", category: "drink", productUrl: "https://www.namedsport.com", logoDomain: "namedsport.com", format: "powder", functionalFocus: ["bcaa"], timing: ["pre", "post", "daily"] },
  { brand: "Named Sport", product: "EAA Amino Tabs", category: "chew", productUrl: "https://www.namedsport.com", logoDomain: "namedsport.com", format: "tablet", functionalFocus: ["eaa"], timing: ["post", "daily"] },

  { brand: "Neversecond", product: "C30 Fuel Drink", category: "drink", productUrl: "https://www.neversecond.com", logoDomain: "neversecond.com", format: "powder", functionalFocus: ["carbo"], timing: ["intra"] },
  { brand: "Neversecond", product: "C30 Fuel Gel", category: "gel", productUrl: "https://www.neversecond.com", logoDomain: "neversecond.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"] },
  { brand: "Neversecond", product: "C30 Fuel Bar", category: "bar", productUrl: "https://www.neversecond.com", logoDomain: "neversecond.com", format: "bar", functionalFocus: ["carbo"], timing: ["pre", "intra"] },
  { brand: "Neversecond", product: "C30+ Caffeine Gel", category: "gel", productUrl: "https://www.neversecond.com", logoDomain: "neversecond.com", format: "gel", functionalFocus: ["carbo", "caffeine"], timing: ["pre", "intra"] },
];
