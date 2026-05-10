import type { FuelingProduct } from "@/lib/nutrition/fueling-product-catalog";
import { buildFuelingProductKey } from "@/lib/nutrition/fueling-product-catalog";

/** Riga canonica per `nutrition_product_catalog` (integratori / fueling da dichiarazioni fornitore). */
export type NutritionCatalogInsertRow = {
  source: "brand-site";
  external_key: string;
  brand: string;
  product_name: string;
  category: string;
  serving_size_g: number | null;
  kcal_100g: number;
  cho_100g: number;
  protein_100g: number;
  fat_100g: number;
  sodium_mg_100g: number | null;
  metadata: Record<string, unknown>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Massa porzione tipica (g) usata solo per scalare CHO dichiarato → /100g quando manca etichetta completa. */
function defaultServingMassG(p: FuelingProduct): number {
  switch (p.format) {
    case "gel":
      return 40;
    case "bar":
      return 45;
    case "chew":
      return 50;
    case "drink":
      return 40;
    case "powder":
      return 40;
    case "tablet":
    case "capsule":
      return 3;
    case "gummies":
      return 10;
    case "sachet":
      return 40;
    default:
      return 40;
  }
}

const MACRO_OVERRIDES_PER100G: Record<
  string,
  { kcal: number; cho: number; protein: number; fat: number; sodiumMg: number | null }
> = {
  // Elettroliti: energia trascurabile, sodio dominante (ordine di grandezza etichetta tipo PH).
  precision_fuel_hydration__ph_1000: { kcal: 12, cho: 2, protein: 0, fat: 0, sodiumMg: 2500 },
  // Pre-workout senza CHO dichiarato: placeholder conservativo (non usare come verità clinica).
  enervit__pre_sport: { kcal: 180, cho: 28, protein: 2, fat: 0, sodiumMg: 120 },
  watt__pre_workout_nitro_pump: { kcal: 160, cho: 22, protein: 3, fat: 0, sodiumMg: 80 },
  powerbar__black_line_pre_workout: { kcal: 170, cho: 24, protein: 4, fat: 0, sodiumMg: 90 },
};

function overrideKey(p: FuelingProduct): string {
  return buildFuelingProductKey(p);
}

/** Deriva macro /100g curati per diario e lookup; preferisce override, poi CHO dichiarato, poi template per categoria. */
export function fuelingProductToCatalogRow(p: FuelingProduct): NutritionCatalogInsertRow {
  const key = overrideKey(p);
  const ov = MACRO_OVERRIDES_PER100G[key];
  const servingG = defaultServingMassG(p);
  const carbG = p.carbohydrateGPerServing;

  let kcal_100g: number;
  let cho_100g: number;
  let protein_100g: number;
  let fat_100g: number;
  let sodium_mg_100g: number | null;

  if (ov) {
    ({ kcal: kcal_100g, cho: cho_100g, protein: protein_100g, fat: fat_100g, sodiumMg: sodium_mg_100g } = ov);
  } else if (carbG != null && carbG > 0 && servingG > 0) {
    cho_100g = round2((carbG / servingG) * 100);
    const isRecoveryLike =
      p.category === "recovery" || (p.functionalFocus.includes("protein") && p.functionalFocus.includes("recovery"));
    if (isRecoveryLike && p.functionalFocus.includes("protein")) {
      protein_100g = round2(Math.max(18, cho_100g * 0.35));
      fat_100g = round2(Math.min(12, cho_100g * 0.08 + 3));
      kcal_100g = round2(cho_100g * 4 + protein_100g * 4 + fat_100g * 9);
    } else {
      protein_100g = p.functionalFocus.includes("protein") ? round2(Math.min(40, cho_100g * 0.2)) : 0;
      fat_100g =
        p.category === "bar" ? round2(Math.min(20, cho_100g * 0.12 + 4)) : p.format === "gel" ? round2(Math.min(6, cho_100g * 0.02)) : 0;
      kcal_100g = round2(cho_100g * 4 + protein_100g * 4 + fat_100g * 9);
    }
    sodium_mg_100g =
      p.functionalFocus.includes("electrolyte") && !p.functionalFocus.includes("carbo")
        ? round2(800 + cho_100g * 2)
        : round2(150 + cho_100g * 3);
  } else if (p.category === "recovery" && p.functionalFocus.includes("protein")) {
    cho_100g = 52;
    protein_100g = 32;
    fat_100g = 6;
    kcal_100g = round2(cho_100g * 4 + protein_100g * 4 + fat_100g * 9);
    sodium_mg_100g = 380;
  } else {
    cho_100g = 55;
    protein_100g = 5;
    fat_100g = 2;
    kcal_100g = round2(cho_100g * 4 + protein_100g * 4 + fat_100g * 9);
    sodium_mg_100g = 200;
  }

  kcal_100g = Math.min(900, Math.max(0, kcal_100g));
  cho_100g = Math.min(100, Math.max(0, cho_100g));
  protein_100g = Math.min(100, Math.max(0, protein_100g));
  fat_100g = Math.min(100, Math.max(0, fat_100g));

  const external_key = `fueling:${key}`;
  const metadata: Record<string, unknown> = {
    kind: "fueling_product",
    fueling_product_key: key,
    supplier_product_url: p.productUrl,
    logo_domain: p.logoDomain,
    image_url: p.imageUrl ?? null,
    format: p.format,
    functional_focus: p.functionalFocus,
    timing: p.timing,
    fueling_category: p.category,
    carbohydrate_g_per_serving_declared: p.carbohydrateGPerServing ?? null,
    assumed_serving_g: servingG,
    macro_method: "supplier_declaration_scaled_v1",
  };

  return {
    source: "brand-site",
    external_key,
    brand: p.brand,
    product_name: p.product,
    category: p.category,
    serving_size_g: servingG,
    kcal_100g,
    cho_100g,
    protein_100g,
    fat_100g,
    sodium_mg_100g,
    metadata,
  };
}
