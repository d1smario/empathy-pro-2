/**
 * Popola nutrition_fdc_food_tags da nutrition_fdc_foods (classificatore rule-based V2).
 *
 * Richiede migration 075 applicata. Usa service role (bypass RLS insert).
 *
 * Esecuzione (root monorepo):
 *   npx tsx apps/web/scripts/classify-fdc-foods-batch.ts [--dry-run] [--limit=5000]
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { classifyFdcFoodRow, taxonomyToDbArrays } from "../lib/nutrition/v2/classify-fdc-description";
import { CLASSIFIER_VERSION } from "../lib/nutrition/v2/fdc-food-taxonomy";

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

const root = path.resolve(__dirname, "../../..");
for (const p of [
  path.join(root, ".env.local"),
  path.join(root, "apps/web/.env.local"),
  path.join(__dirname, "../.env.local"),
]) {
  loadEnvFile(p);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Serve NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const pageSize = limitArg ? Math.min(20000, Math.max(100, Number(limitArg.split("=")[1]) || 5000)) : 5000;

const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { count, error: countErr } = await admin
    .from("nutrition_fdc_foods")
    .select("fdc_id", { count: "exact", head: true });
  if (countErr) {
    console.error("Count nutrition_fdc_foods:", countErr.message);
    process.exit(1);
  }
  console.log(`nutrition_fdc_foods: ~${count ?? "?"} righe · batch limit ${pageSize} · classifier ${CLASSIFIER_VERSION}`);

  const { data: foods, error } = await admin
    .from("nutrition_fdc_foods")
    .select("fdc_id, description, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g")
    .gt("kcal_100g", 0)
    .order("fdc_id")
    .limit(pageSize);

  if (error || !Array.isArray(foods)) {
    console.error("Fetch foods:", error?.message ?? "no data");
    process.exit(1);
  }

  const rows = foods
    .map((row) => {
      const fdcId = Math.round(Number((row as Record<string, unknown>).fdc_id));
      const description = String((row as Record<string, unknown>).description ?? "").trim();
      if (!Number.isFinite(fdcId) || fdcId < 1 || !description) return null;
      const tags = classifyFdcFoodRow({
        description,
        kcalPer100g: Number((row as Record<string, unknown>).kcal_100g) || 0,
        proteinG: Number((row as Record<string, unknown>).protein_100g) || 0,
        carbsG: Number((row as Record<string, unknown>).carbs_100g) || 0,
        fatG: Number((row as Record<string, unknown>).fat_100g) || 0,
        fiberG:
          (row as Record<string, unknown>).fiber_100g != null
            ? Number((row as Record<string, unknown>).fiber_100g)
            : undefined,
      });
      return { fdc_id: fdcId, ...taxonomyToDbArrays(tags), classified_at: new Date().toISOString() };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  console.log(`Classificati ${rows.length} alimenti`);
  if (dryRun) {
    console.log("Dry-run — esempio:", rows[0]);
    return;
  }

  const chunk = 200;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error: upErr } = await admin.from("nutrition_fdc_food_tags").upsert(slice, { onConflict: "fdc_id" });
    if (upErr) {
      console.error(`Upsert chunk @${i}:`, upErr.message);
      process.exit(1);
    }
    upserted += slice.length;
    process.stdout.write(`\rUpsert ${upserted}/${rows.length}`);
  }
  console.log("\nDone.");
}

void main();
