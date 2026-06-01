/**
 * Bulk warmer per la cache USDA `nutrition_fdc_foods`.
 *
 * Per ogni query in `QUERIES`:
 *   1. Cerca su USDA FDC (preferenza Foundation/SR Legacy, poi Branded come fallback).
 *   2. Prende il primo fdcId rilevante.
 *   3. Importa il dettaglio (macro + micro + raw + indici metabolici stimati lato server).
 *   4. Upsert in Supabase `nutrition_fdc_foods` (idempotente).
 *
 * Non sostituisce `warm-usda-micros.ts` (legacy, 12 fdcId hardcoded). I due possono coesistere.
 *
 * Output:
 *   - Stampa riga per query: OK fdcId + descrizione, oppure FAIL + motivo.
 *   - Salva un report JSON con i fdcId risolti in `apps/web/scripts/.warm-usda-bulk-aliases.json`
 *     (utile per estendere `lib/nutrition/canonical-food-fdc-aliases.ts`).
 *
 * Esecuzione (dalla root del monorepo):
 *   npx tsx apps/web/scripts/warm-usda-bulk.ts
 *
 * Env richieste (lette da apps/web/.env.local):
 *   - USDA_API_KEY
 *   - SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import fs from "node:fs";
import path from "node:path";
import { summarizePer100gFromFdcNutrientRows } from "../lib/nutrition/usda-fdc-food-detail";
import { partitionFdcNutrientsFromCompact, type FdcMicroPer100g } from "../lib/nutrition/fdc-micronutrient-extract";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, "").trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

/** Lista alimenti italiani comuni espressa come query USDA. */
const QUERIES: Array<{ id: string; query: string; aliasFor?: string }> = [
  // Cereali / pane / pasta
  { id: "bread_white", query: "Bread, white, commercially prepared", aliasFor: "bread_white" },
  { id: "bread_wholewheat", query: "Bread, whole-wheat, commercially prepared" },
  { id: "pasta_cooked", query: "Pasta, cooked, unenriched, without added salt", aliasFor: "pasta_cooked" },
  { id: "pasta_dry", query: "Pasta, dry, unenriched", aliasFor: "pasta_dry" },
  { id: "rice_white_cooked", query: "Rice, white, long-grain, regular, cooked, unenriched, without salt", aliasFor: "rice_cooked" },
  { id: "rice_white_dry", query: "Rice, white, long-grain, regular, raw, unenriched", aliasFor: "rice_dry" },
  { id: "rice_brown_cooked", query: "Rice, brown, long-grain, cooked" },
  { id: "oats_raw", query: "Oats, raw", aliasFor: "oat_dry" },
  { id: "spelt_cooked", query: "Spelt, cooked", aliasFor: "farro_cooked" },
  { id: "quinoa_cooked", query: "Quinoa, cooked" },
  { id: "couscous_cooked", query: "Couscous, cooked" },
  { id: "barley_cooked", query: "Barley, pearled, cooked" },
  { id: "corn_cooked", query: "Corn, sweet, yellow, cooked, boiled" },
  { id: "polenta_corn_meal", query: "Cornmeal, whole-grain, yellow" },
  { id: "crackers_whole", query: "Crackers, whole-wheat, regular", aliasFor: "crackers_whole" },

  // Tuberi
  { id: "potato_baked", query: "Potatoes, baked, flesh and skin, without salt", aliasFor: "potato_cooked" },
  { id: "sweet_potato_baked", query: "Sweet potato, cooked, baked in skin, without salt" },

  // Verdure
  { id: "spinach_raw", query: "Spinach, raw", aliasFor: "spinach_raw" },
  { id: "tomato_raw", query: "Tomatoes, red, ripe, raw, year round average", aliasFor: "tomato_raw" },
  { id: "carrot_raw", query: "Carrots, raw", aliasFor: "carrot_raw" },
  { id: "broccoli_raw", query: "Broccoli, raw", aliasFor: "broccoli_raw" },
  { id: "cauliflower_raw", query: "Cauliflower, raw" },
  { id: "bell_pepper_red", query: "Peppers, sweet, red, raw", aliasFor: "bell_pepper_red" },
  { id: "zucchini_raw", query: "Squash, summer, zucchini, includes skin, raw", aliasFor: "zucchini_raw" },
  { id: "eggplant_raw", query: "Eggplant, raw" },
  { id: "lettuce_romaine", query: "Lettuce, cos or romaine, raw", aliasFor: "lettuce_romaine" },
  { id: "cucumber_raw", query: "Cucumber, with peel, raw" },
  { id: "onion_raw", query: "Onions, raw" },
  { id: "garlic_raw", query: "Garlic, raw" },
  { id: "artichoke_raw", query: "Artichokes, raw" },
  { id: "asparagus_raw", query: "Asparagus, raw", aliasFor: "asparagus_raw" },
  { id: "cabbage_raw", query: "Cabbage, raw" },
  { id: "beetroot_raw", query: "Beets, raw", aliasFor: "beetroot_raw" },
  { id: "mushrooms_raw", query: "Mushrooms, white, raw" },
  { id: "fennel_raw", query: "Fennel, bulb, raw" },
  { id: "kale_raw", query: "Kale, raw", aliasFor: "kale_raw" },
  { id: "arugula_raw", query: "Arugula, raw", aliasFor: "arugula_raw" },
  { id: "leek_raw", query: "Leeks, (bulb and lower leaf-portion), raw" },

  // Legumi
  { id: "lentils_cooked", query: "Lentils, mature seeds, cooked, boiled, without salt", aliasFor: "legumes_cooked" },
  { id: "beans_kidney_cooked", query: "Beans, kidney, all types, mature seeds, cooked, boiled, without salt" },
  { id: "beans_white_cooked", query: "Beans, white, mature seeds, cooked, boiled, with salt" },
  { id: "beans_black_cooked", query: "Beans, black, mature seeds, cooked, boiled, without salt" },
  { id: "chickpeas_cooked", query: "Chickpeas, mature seeds, cooked, boiled, without salt", aliasFor: "chickpeas_cooked" },
  { id: "peas_green", query: "Peas, green, raw" },
  { id: "soybeans_cooked", query: "Soybeans, mature seeds, cooked, boiled, without salt" },
  { id: "edamame_cooked", query: "Edamame, frozen, prepared" },
  { id: "fava_beans_cooked", query: "Broadbeans (fava beans), mature seeds, cooked, boiled, without salt" },

  // Frutta
  { id: "apple_raw", query: "Apples, raw, with skin", aliasFor: "apple_raw" },
  { id: "banana_raw", query: "Bananas, raw" },
  { id: "orange_raw", query: "Oranges, raw, all commercial varieties", aliasFor: "orange_raw" },
  { id: "strawberries_raw", query: "Strawberries, raw", aliasFor: "strawberries_raw" },
  { id: "blueberries_raw", query: "Blueberries, raw", aliasFor: "blueberries_raw" },
  { id: "raspberries_raw", query: "Raspberries, raw" },
  { id: "pear_raw", query: "Pears, raw", aliasFor: "pear_raw" },
  { id: "peach_raw", query: "Peaches, raw" },
  { id: "apricot_raw", query: "Apricots, raw" },
  { id: "plum_raw", query: "Plums, raw" },
  { id: "grapes_raw", query: "Grapes, red or green (european type, such as thompson seedless), raw" },
  { id: "watermelon_raw", query: "Watermelon, raw" },
  { id: "cantaloupe_raw", query: "Melons, cantaloupe, raw" },
  { id: "pineapple_raw", query: "Pineapple, raw, all varieties" },
  { id: "kiwi_raw", query: "Kiwifruit, green, raw", aliasFor: "kiwi_raw" },
  { id: "mango_raw", query: "Mangos, raw" },
  { id: "pomegranate_raw", query: "Pomegranates, raw" },
  { id: "lemon_raw", query: "Lemons, raw, without peel" },
  { id: "fig_raw", query: "Figs, raw" },
  { id: "cherries_raw", query: "Cherries, sweet, raw" },

  // Proteine animali
  { id: "chicken_breast_raw", query: "Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw", aliasFor: "chicken_breast" },
  { id: "chicken_thigh_raw", query: "Chicken, broilers or fryers, thigh, meat only, raw" },
  { id: "turkey_breast_raw", query: "Turkey, all classes, breast, meat only, raw" },
  { id: "beef_lean_raw", query: "Beef, ground, raw", aliasFor: "beef_lean" },
  { id: "beef_sirloin_raw", query: "Beef, top sirloin, steak, raw" },
  { id: "pork_tenderloin_raw", query: "Pork, fresh, loin, tenderloin, separable lean only, raw" },
  { id: "pork_ham_lean", query: "Pork, cured, ham, boneless, separable lean only, unheated", aliasFor: "deli_lean" },
  { id: "lamb_lean_raw", query: "Lamb, ground, raw" },
  { id: "egg_whole_raw", query: "Egg, whole, raw, fresh", aliasFor: "egg_whole" },
  { id: "egg_white_raw", query: "Egg, white, raw, fresh" },
  { id: "salmon_atlantic_raw", query: "Fish, salmon, Atlantic, farmed, raw", aliasFor: "fish_white" },
  { id: "tuna_fresh_raw", query: "Fish, tuna, fresh, bluefin, raw" },
  { id: "tuna_canned_water", query: "Fish, tuna, light, canned in water, drained solids" },
  { id: "cod_raw", query: "Fish, cod, Atlantic, raw" },
  { id: "sea_bass_raw", query: "Fish, sea bass, mixed species, raw" },
  { id: "mackerel_raw", query: "Fish, mackerel, Atlantic, raw" },
  { id: "sardines_canned_oil", query: "Fish, sardine, Atlantic, canned in oil, drained solids with bone" },
  { id: "anchovy_canned_oil", query: "Fish, anchovy, european, canned in oil, drained solids" },
  { id: "shrimp_raw", query: "Crustaceans, shrimp, mixed species, raw" },
  { id: "octopus_raw", query: "Mollusks, octopus, common, raw" },
  { id: "squid_raw", query: "Mollusks, squid, mixed species, raw" },
  { id: "mussels_raw", query: "Mollusks, mussel, blue, raw" },
  { id: "clams_raw", query: "Mollusks, clam, mixed species, raw" },
  { id: "trout_raw", query: "Fish, trout, rainbow, farmed, raw" },

  // Latticini
  { id: "milk_whole", query: "Milk, whole, 3.25% milkfat, with added vitamin D" },
  { id: "milk_2pct", query: "Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D", aliasFor: "milk_2pct" },
  { id: "milk_nonfat", query: "Milk, nonfat, fluid, with added vitamin A and vitamin D" },
  { id: "milk_goat", query: "Milk, goat, fluid, with added vitamin D", aliasFor: "milk_goat" },
  { id: "yogurt_plain", query: "Yogurt, plain, whole milk, 8 grams protein per 8 ounce", aliasFor: "yogurt_plain" },
  { id: "yogurt_greek", query: "Yogurt, Greek, plain, nonfat" },
  { id: "cheese_parmesan", query: "Cheese, parmesan, grated", aliasFor: "cheese_hard" },
  { id: "cheese_mozzarella", query: "Cheese, mozzarella, low moisture, part-skim" },
  { id: "cheese_ricotta", query: "Cheese, ricotta, whole milk", aliasFor: "ricotta_cheese" },
  { id: "cheese_cottage", query: "Cheese, cottage, lowfat, 1% milkfat", aliasFor: "cottage_cheese" },
  { id: "cheese_cheddar", query: "Cheese, cheddar" },
  { id: "butter_salted", query: "Butter, salted" },

  // Grassi e semi
  { id: "olive_oil", query: "Oil, olive, salad or cooking", aliasFor: "olive_oil" },
  { id: "avocado_raw", query: "Avocados, raw, all commercial varieties", aliasFor: "avocado" },
  { id: "almonds_raw", query: "Nuts, almonds, raw", aliasFor: "almonds_raw" },
  { id: "walnuts_raw", query: "Nuts, walnuts, English" },
  { id: "hazelnuts_raw", query: "Nuts, hazelnuts or filberts" },
  { id: "pistachios_raw", query: "Nuts, pistachio nuts, raw" },
  { id: "pine_nuts_raw", query: "Nuts, pine nuts, dried" },
  { id: "pumpkin_seeds_raw", query: "Seeds, pumpkin and squash seed kernels, dried", aliasFor: "pumpkin_seeds_raw" },
  { id: "sunflower_seeds_raw", query: "Seeds, sunflower seed kernels, dried" },
  { id: "chia_seeds", query: "Seeds, chia seeds, dried" },
  { id: "flaxseed_ground", query: "Seeds, flaxseed" },

  // Dolcificanti / cioccolato / bevande
  { id: "honey", query: "Honey" },
  { id: "sugar_white", query: "Sugars, granulated" },
  { id: "maple_syrup", query: "Syrups, maple" },
  { id: "dark_chocolate_70", query: "Chocolate, dark, 70-85% cacao solids", aliasFor: "dark_chocolate_70" },
  { id: "coffee_brewed", query: "Beverages, coffee, brewed, prepared with tap water" },
  { id: "tea_green", query: "Beverages, tea, green, brewed, regular" },
];

type SearchHit = { fdcId: number; description: string; dataType?: string };

async function searchOnce(
  apiKey: string,
  query: string,
  opts: { dataType?: string; skipFdcId?: number } = {},
): Promise<SearchHit | null> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("dataType", opts.dataType ?? "Foundation,SR Legacy");
  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const foods = Array.isArray(data?.foods) ? (data.foods as Array<Record<string, unknown>>) : [];
  for (const row of foods) {
    const id = Number(row.fdcId);
    if (!Number.isFinite(id) || id < 1) continue;
    if (opts.skipFdcId && id === opts.skipFdcId) continue;
    const description = String(row.description ?? "").trim();
    const dataType = typeof row.dataType === "string" ? row.dataType : undefined;
    return { fdcId: id, description, dataType };
  }
  return null;
}

const toNum = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

function compactRawNutrients(nutrients: Array<Record<string, unknown>>): FdcMicroPer100g[] {
  return nutrients
    .map((row) => {
      const nested = (row.nutrient as Record<string, unknown> | undefined) ?? {};
      const id = toNum(nested.id ?? row.nutrientId);
      const name = String(nested.name ?? row.nutrientName ?? "").trim();
      const unit = String(nested.unitName ?? row.unitName ?? "").trim() || "—";
      const amount = toNum(row.amount ?? row.value);
      if (!id || !name || amount == null || amount < 0) return null;
      return { nutrientId: Math.round(id), name, amountPer100g: amount, unit };
    })
    .filter((row): row is FdcMicroPer100g => Boolean(row));
}

function pickByName(nutrients: Array<Record<string, unknown>>, names: string[]): number | null {
  const targets = names.map((n) => n.toLowerCase());
  for (const row of nutrients) {
    const nested = (row.nutrient as Record<string, unknown> | undefined) ?? {};
    const name = String(nested.name ?? row.nutrientName ?? "").trim().toLowerCase();
    if (!name) continue;
    if (targets.some((t) => name === t || name.includes(t))) {
      const amount = toNum(row.amount ?? row.value);
      if (amount != null && amount >= 0) return amount;
    }
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function estimateMetabolic(carbs: number, protein: number, fat: number, fiber: number, sugars: number) {
  const availableCarbs = Math.max(0, carbs - fiber);
  const carbEnergy = availableCarbs * 4;
  const proteinEnergy = protein * 4;
  const fatEnergy = fat * 9;
  const energy = Math.max(1, carbEnergy + proteinEnergy + fatEnergy);
  const carbEnergyPct = carbEnergy / energy;
  const sugarShare = availableCarbs > 0 ? sugars / availableCarbs : 0;
  const fiberDampening = Math.min(18, fiber * 1.2);
  const gi = Math.min(92, Math.max(18, 28 + carbEnergyPct * 58 + sugarShare * 18 - fiberDampening - Math.min(10, fat * 0.45)));
  const ii = Math.min(115, Math.max(18, gi * 0.72 + Math.min(28, protein * 1.25) + Math.min(12, fat * 0.35)));
  return {
    glycemicIndex: round2(gi),
    insulinIndex: round2(ii),
    glycemicLoad: round2((gi * availableCarbs) / 100),
    insulinLoad: round2((ii * (availableCarbs + protein * 0.45)) / 100),
    availableCarbs: round2(availableCarbs),
    sugarShare: round2(sugarShare),
  };
}

async function importFood(
  apiKey: string,
  fdcId: number,
  supabaseUrl: string,
  serviceRole: string,
): Promise<{ error: string } | { ok: true; description: string; dataType: string | null }> {
  const detailUrl = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(detailUrl, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return { error: `USDA detail ${res?.status ?? "no-response"}` };
  const raw = (await res.json()) as Record<string, unknown>;
  const nutrients = (Array.isArray(raw.foodNutrients) ? raw.foodNutrients : []) as Array<Record<string, unknown>>;
  const macro = summarizePer100gFromFdcNutrientRows(nutrients);
  if (macro.kcalPer100g == null && macro.carbsPer100g == null && macro.proteinPer100g == null && macro.fatPer100g == null) {
    return { error: "no nutrients" };
  }
  const fiber = pickByName(nutrients, ["fiber, total dietary", "fiber"]) ?? null;
  const sugars = pickByName(nutrients, ["sugars, total including", "sugars, total"]) ?? null;
  const carbs = Math.max(0, macro.carbsPer100g ?? 0);
  const protein = Math.max(0, macro.proteinPer100g ?? 0);
  const fat = Math.max(0, macro.fatPer100g ?? 0);
  const m = estimateMetabolic(carbs, protein, fat, fiber ?? 0, sugars ?? 0);

  const compactRows = compactRawNutrients(nutrients);
  const parts = partitionFdcNutrientsFromCompact(compactRows);

  const payload = {
    fdc_id: fdcId,
    description: String(raw.description ?? `FDC ${fdcId}`),
    data_type: raw.dataType != null ? String(raw.dataType) : null,
    publication_date: raw.publicationDate != null ? String(raw.publicationDate) : null,
    food_category: raw.foodCategory != null ? String(raw.foodCategory) : null,
    kcal_100g: Math.max(0, macro.kcalPer100g ?? 0),
    carbs_100g: carbs,
    protein_100g: protein,
    fat_100g: fat,
    fiber_100g: fiber,
    sugars_100g: sugars,
    sodium_mg_100g: macro.sodiumMgPer100g,
    glycemic_index_estimate: m.glycemicIndex,
    insulin_index_estimate: m.insulinIndex,
    glycemic_load_100g: m.glycemicLoad,
    insulin_load_100g: m.insulinLoad,
    metabolic_indices: {
      method: "macro_profile_estimate_v1",
      source: "warm_usda_bulk_v1",
      caveat: "Estimated from USDA macro profile; not a measured glycemic or insulin index.",
      availableCarbsPer100g: m.availableCarbs,
      sugarShare: m.sugarShare,
    },
    vitamins: parts.vitamins,
    minerals: parts.minerals,
    amino_acids: parts.aminoAcids,
    fatty_acids: parts.fattyAcids,
    other_nutrients: parts.other,
    nutrients_raw: compactRows,
    source_payload: {
      bulkWarmer: "warm_usda_bulk_v1",
      fdcId: raw.fdcId ?? fdcId,
    },
    refreshed_at: new Date().toISOString(),
  };

  const upsertRes = await fetch(`${supabaseUrl}/rest/v1/nutrition_fdc_foods?on_conflict=fdc_id`, {
    method: "POST",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  }).catch(() => null);
  if (!upsertRes?.ok) {
    const errText = (await upsertRes?.text().catch(() => "")) ?? "";
    return { error: `upsert ${upsertRes?.status ?? "no-response"} ${errText.slice(0, 80)}` };
  }
  return { ok: true as const, description: payload.description, dataType: payload.data_type };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  const root = process.cwd();
  loadEnvFile(path.join(root, ".env.local.production"));
  loadEnvFile(path.join(root, "apps", "web", ".env.local"));
  loadEnvFile(path.join(root, ".env.local"));

  const apiKeyRaw = process.env.USDA_API_KEY?.trim();
  if (!apiKeyRaw) throw new Error("USDA_API_KEY non configurata in .env.local");
  const supabaseUrlRaw = process.env.SUPABASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!supabaseUrlRaw) throw new Error("SUPABASE_URL non configurata");
  const serviceRoleRaw = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleRaw) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata");
  const apiKey: string = apiKeyRaw;
  const supabaseUrl: string = supabaseUrlRaw;
  const serviceRole: string = serviceRoleRaw;

  const reportPath = path.join(root, "apps", "web", "scripts", "usda-bulk-aliases.json");
  const retryOnly = process.argv.includes("--retry-failed") || process.env.WARM_RETRY_ONLY === "1";
  let queue = [...QUERIES];
  let priorAliases: Record<string, { fdcId: number; description: string; dataType?: string }> = {};
  if (retryOnly && fs.existsSync(reportPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(reportPath, "utf8")) as { aliases?: Record<string, { fdcId: number; description: string; dataType?: string }> };
      priorAliases = prev.aliases ?? {};
      const okIds = new Set(Object.keys(priorAliases));
      queue = QUERIES.filter((q) => !okIds.has(q.id));
      console.log(`▶ Modalità retry: salto ${QUERIES.length - queue.length} alimenti già OK, retry su ${queue.length}.`);
    } catch (err) {
      console.warn(`Report precedente non leggibile: ${(err as Error).message}. Procedo full.`);
    }
  }

  const aliasReport: Record<string, { fdcId: number; description: string; dataType?: string }> = { ...priorAliases };
  let ok = 0;
  let fail = 0;
  let skipped = 0;
  const failed: Array<{ id: string; reason: string }> = [];
  const total = queue.length;

  console.log(`▶ Bulk USDA warmer: ${total} query in coda. Inizio…`);

  async function tryResolveAndImport(query: string, dataType?: string, skipFdcId?: number) {
    const hit = await searchOnce(apiKey, query, { dataType, skipFdcId });
    if (!hit) return { kind: "no_hit" as const };
    const result = await importFood(apiKey, hit.fdcId, supabaseUrl, serviceRole);
    if ("error" in result) {
      return { kind: "import_error" as const, hit, error: result.error };
    }
    return { kind: "ok" as const, hit, description: result.description, dataType: result.dataType };
  }

  for (let i = 0; i < total; i++) {
    const item = queue[i];
    const prefix = `[${String(i + 1).padStart(3, " ")}/${total}]`;
    try {
      // 1° tentativo: Foundation + SR Legacy.
      let attempt = await tryResolveAndImport(item.query);
      // 2° tentativo: SR Legacy only (i Foundation più recenti capita siano deprecati su /food/{id}).
      if (attempt.kind !== "ok") {
        const skipFdcId = attempt.kind === "import_error" ? attempt.hit.fdcId : undefined;
        await sleep(120);
        attempt = await tryResolveAndImport(item.query, "SR Legacy", skipFdcId);
      }
      // 3° tentativo: query "morbida" (rimuove tutto dopo la prima virgola) su SR Legacy.
      if (attempt.kind !== "ok") {
        const softQuery = item.query.split(",")[0]?.trim() ?? item.query;
        if (softQuery && softQuery !== item.query) {
          await sleep(120);
          attempt = await tryResolveAndImport(softQuery, "SR Legacy");
        }
      }

      if (attempt.kind === "ok") {
        ok += 1;
        console.log(`${prefix} ✓ ${item.id}: ${attempt.hit.fdcId} (${attempt.dataType ?? "?"}) ${attempt.description.slice(0, 60)}`);
        aliasReport[item.id] = {
          fdcId: attempt.hit.fdcId,
          description: attempt.description,
          dataType: attempt.dataType ?? undefined,
        };
      } else if (attempt.kind === "no_hit") {
        skipped += 1;
        console.log(`${prefix} — ${item.id}: no FDC hit for "${item.query.slice(0, 70)}"`);
        failed.push({ id: item.id, reason: "search_no_hit" });
      } else {
        fail += 1;
        console.log(`${prefix} ✘ ${item.id}: FAIL ${attempt.error}`);
        failed.push({ id: item.id, reason: attempt.error });
      }
    } catch (err) {
      fail += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.log(`${prefix} ✘ ${item.id}: EXC ${message.slice(0, 100)}`);
      failed.push({ id: item.id, reason: `exception:${message.slice(0, 80)}` });
    }
    await sleep(180);
  }

  fs.writeFileSync(reportPath, JSON.stringify({ ok, fail, skipped, total, generatedAt: new Date().toISOString(), aliases: aliasReport, failed }, null, 2));
  console.log(`\n▶ Risultato: ${ok} ok · ${fail} fail · ${skipped} skip su ${total}.`);
  console.log(`▶ Report: ${reportPath}`);
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Bulk warmer error: ${message}`);
  process.exit(1);
});
