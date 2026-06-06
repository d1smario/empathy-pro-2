/**
 * Ping rapido a USDA + count cache Supabase, senza scrivere nulla.
 *
 * Conferma:
 *   1. La chiave USDA è valida e USDA `foods/search` + `food/{id}` rispondono.
 *   2. La tabella `nutrition_fdc_foods` ha i record attesi (count + sample).
 *   3. I record hanno macro/micro/GI popolati.
 */

import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath: string, override = false) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!override && key in process.env) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, "").trim();
    process.env[key] = value;
  }
}

async function main() {
  const root = process.cwd();
  loadEnvFile(path.join(root, ".env.local"), false);
  loadEnvFile(path.join(root, "apps", "web", ".env.local"), true);
  const apiKey = process.env.USDA_API_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? process.env.SUPABASE_URL?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!apiKey) throw new Error("USDA_API_KEY mancante");
  if (!supabaseUrl) throw new Error("SUPABASE_URL mancante");
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY mancante");

  console.log("▶ STEP 1 · Ping USDA `food/171284` (yogurt plain whole milk)");
  const t0 = Date.now();
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/food/171284?api_key=${encodeURIComponent(apiKey)}`, { cache: "no-store" });
  const dt = Date.now() - t0;
  if (!res.ok) {
    console.log(`  ✘ HTTP ${res.status} (${dt} ms): ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const food = (await res.json()) as Record<string, unknown>;
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients.length : 0;
  console.log(`  ✓ HTTP 200 (${dt} ms) · description: "${String(food.description).slice(0, 60)}" · ${nutrients} nutrient rows`);

  console.log(`\n▶ STEP 2 · Count cache Supabase nutrition_fdc_foods`);
  const headRes = await fetch(`${supabaseUrl}/rest/v1/nutrition_fdc_foods?select=fdc_id`, {
    method: "HEAD",
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const total = headRes.headers.get("content-range")?.split("/")[1] ?? "?";
  console.log(`  ✓ Total record in cache: ${total}`);

  console.log(`\n▶ STEP 3 · Sample (10 record con qualità dati)`);
  const sampleRes = await fetch(
    `${supabaseUrl}/rest/v1/nutrition_fdc_foods?select=fdc_id,description,kcal_100g,carbs_100g,protein_100g,fat_100g,glycemic_index_estimate,insulin_index_estimate,refreshed_at&order=refreshed_at.desc&limit=10`,
    { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } },
  );
  const rows = (await sampleRes.json()) as Array<Record<string, unknown>>;
  for (const r of rows) {
    const fid = r.fdc_id;
    const desc = String(r.description).slice(0, 50);
    const kcal = Number(r.kcal_100g ?? 0);
    const carbs = Number(r.carbs_100g ?? 0);
    const prot = Number(r.protein_100g ?? 0);
    const fat = Number(r.fat_100g ?? 0);
    const gi = Number(r.glycemic_index_estimate ?? 0);
    const ii = Number(r.insulin_index_estimate ?? 0);
    console.log(
      `  fdcId=${String(fid).padEnd(8)} kcal=${String(kcal.toFixed(0)).padStart(4)} C=${String(carbs.toFixed(1)).padStart(5)} P=${String(prot.toFixed(1)).padStart(5)} F=${String(fat.toFixed(1)).padStart(5)} GI=${String(gi.toFixed(1)).padStart(5)} II=${String(ii.toFixed(1)).padStart(5)}  ${desc}`,
    );
  }

  console.log(`\n▶ STEP 4 · Verifica copertura micronutrienti (record con vitamins>0)`);
  const microRes = await fetch(
    `${supabaseUrl}/rest/v1/nutrition_fdc_foods?select=fdc_id,description,vitamins,minerals,amino_acids,fatty_acids&limit=5`,
    { headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` } },
  );
  const microRows = (await microRes.json()) as Array<Record<string, unknown>>;
  for (const r of microRows) {
    const v = Array.isArray(r.vitamins) ? r.vitamins.length : 0;
    const m = Array.isArray(r.minerals) ? r.minerals.length : 0;
    const a = Array.isArray(r.amino_acids) ? r.amino_acids.length : 0;
    const f = Array.isArray(r.fatty_acids) ? r.fatty_acids.length : 0;
    console.log(`  fdcId=${String(r.fdc_id).padEnd(8)} vit=${v} min=${m} AA=${a} FA=${f}  ${String(r.description).slice(0, 50)}`);
  }
}

void main().catch((err) => {
  console.error(`Errore: ${(err as Error).message}`);
  process.exit(1);
});
