/**
 * Classifica nutrition_fdc_foods → nutrition_fdc_food_tags con OpenAI (hybrid + rules).
 * I conteggi dieta (vegani, celiaci, …) emergono dal catalogo reale, non da soglie fisse.
 *
 * Prerequisiti: migration 075 + 076 applicate; catalogo USDA importato.
 *
 * Esecuzione (root monorepo):
 *   npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/classify-fdc-foods-ai-batch.ts --dry-run --limit=25
 *   npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/classify-fdc-foods-ai-batch.ts --offset=0 --limit=500
 *   npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/classify-fdc-foods-ai-batch.ts
 *   npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/classify-fdc-foods-ai-batch.ts --stats-only
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 * Modello: OPENAI_FDC_TAXONOMY_MODEL (default gpt-4o-mini)
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { classifyFdcFoodBatchHybrid } from "../lib/nutrition/v2/fdc-ai-taxonomy-classifier";
import { taxonomyToDbArrays } from "../lib/nutrition/v2/classify-fdc-description";

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

const root = path.resolve(__dirname, "../../..");
loadEnvFile(path.join(root, ".env.local"), false);
loadEnvFile(path.join(root, "apps", "web", ".env.local"), true);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const statsOnly = args.includes("--stats-only");
const offset = Math.max(0, Number(args.find((a) => a.startsWith("--offset="))?.split("=")[1] ?? 0) || 0);
const limitArg = args.find((a) => a.startsWith("--limit="));
const maxRows = limitArg ? Math.min(20000, Math.max(1, Number(limitArg.split("=")[1]) || 5000)) : 20000;
const batchSize = Math.min(50, Math.max(5, Number(args.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? 50) || 50));

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Serve NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function loadTaggedFdcIds(): Promise<Set<number>> {
  const tagged = new Set<number>();
  const page = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await admin
      .from("nutrition_fdc_food_tags")
      .select("fdc_id")
      .order("fdc_id")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) tagged.add(Math.round(Number(row.fdc_id)));
    if (data.length < page) break;
    from += page;
  }
  return tagged;
}

async function printDietStats() {
  const { count: foodCount } = await admin.from("nutrition_fdc_foods").select("fdc_id", { count: "exact", head: true });
  const { count: tagCount } = await admin.from("nutrition_fdc_food_tags").select("fdc_id", { count: "exact", head: true });

  console.log(`\n▶ Catalogo: nutrition_fdc_foods ≈ ${foodCount ?? "?"} · tags ≈ ${tagCount ?? "?"}`);

  const profiles = ["vegan", "vegetarian", "celiac", "lactose_free", "mediterranean", "thai", "paleo", "low_histamine"] as const;
  for (const p of profiles) {
    const { count } = await admin
      .from("nutrition_fdc_food_tags")
      .select("fdc_id", { count: "exact", head: true })
      .contains("diet_profile", [p]);
    console.log(`  diet_profile @> {${p}}: ${count ?? 0}`);
  }

  const excludes = ["gluten", "animal", "lactose", "grain", "legume", "high_histamine"] as const;
  for (const e of excludes) {
    const { count } = await admin
      .from("nutrition_fdc_food_tags")
      .select("fdc_id", { count: "exact", head: true })
      .contains("diet_exclude", [e]);
    console.log(`  diet_exclude @> {${e}}: ${count ?? 0}`);
  }
}

async function main() {
  if (statsOnly) {
    await printDietStats();
    return;
  }

  const { count: totalFoods, error: countErr } = await admin
    .from("nutrition_fdc_foods")
    .select("fdc_id", { count: "exact", head: true });
  const { count: eligibleFoods } = await admin
    .from("nutrition_fdc_foods")
    .select("fdc_id", { count: "exact", head: true })
    .gt("kcal_100g", 0);
  if (countErr) {
    console.error(countErr.message);
    process.exit(1);
  }
  const tagged = await loadTaggedFdcIds();
  const target = eligibleFoods ?? totalFoods ?? 0;
  const startPct = target > 0 ? Math.round((tagged.size / target) * 100) : 0;
  console.log(
    `▶ Catalogo: ${totalFoods ?? "?"} alimenti · ${target} classificabili (kcal>0) · già taggati: ${tagged.size} (${startPct}%) · batch ${batchSize}`,
  );

  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) console.warn("▶ OPENAI_API_KEY assente: solo rules fallback");

  const pageSize = 500;
  let scanned = 0;
  let upserted = 0;
  let skipped = 0;
  let cursor = offset;

  while (upserted < maxRows) {
    const { data: foods, error } = await admin
      .from("nutrition_fdc_foods")
      .select("fdc_id, description, food_category, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g")
      .gt("kcal_100g", 0)
      .order("fdc_id")
      .range(cursor, cursor + pageSize - 1);

    if (error || !Array.isArray(foods) || foods.length === 0) break;

    const pending = foods.filter((row) => !tagged.has(Math.round(Number((row as { fdc_id: number }).fdc_id))));
    skipped += foods.length - pending.length;
    scanned += foods.length;

    for (let i = 0; i < pending.length && upserted < maxRows; i += batchSize) {
      const slice = pending.slice(i, i + batchSize);
      const inputs = slice.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          fdcId: Math.round(Number(r.fdc_id)),
          description: String(r.description ?? ""),
          foodCategory: r.food_category != null ? String(r.food_category) : null,
          kcalPer100g: Number(r.kcal_100g) || 0,
          proteinPer100g: Number(r.protein_100g) || 0,
          carbsPer100g: Number(r.carbs_100g) || 0,
          fatPer100g: Number(r.fat_100g) || 0,
          fiberPer100g: r.fiber_100g != null ? Number(r.fiber_100g) : null,
        };
      });

      const taxonomies = await classifyFdcFoodBatchHybrid(inputs);
      const rows = inputs.map((inp, idx) => ({
        fdc_id: inp.fdcId,
        ...taxonomyToDbArrays(taxonomies[idx]!),
        classified_at: new Date().toISOString(),
      }));

      if (!dryRun) {
        const { error: upErr } = await admin.from("nutrition_fdc_food_tags").upsert(rows, { onConflict: "fdc_id" });
        if (upErr) {
          console.error("Upsert error:", upErr.message);
          if (upErr.message.includes("diet_exclude") || upErr.message.includes("meal_role")) {
            console.error("Applica migration 076_nutrition_fdc_food_tags_extended.sql in Supabase SQL Editor.");
          }
          process.exit(1);
        }
        upserted += rows.length;
        for (const row of rows) tagged.add(row.fdc_id);
      }

      const totalTagged = tagged.size;
      const pct = target > 0 ? Math.round((totalTagged / target) * 100) : 0;
      if (upserted % 50 === 0 || upserted <= batchSize) {
        const ts = new Date().toISOString().slice(11, 19);
        console.log(
          `[${ts}] ▶ ${totalTagged}/${target} (${pct}%) · +${upserted} sessione · scansionati ${scanned}${dryRun ? " dry-run" : ""}`,
        );
      }
    }

    cursor += foods.length;
    if (foods.length < pageSize) break;
  }

  const finalPct = target > 0 ? Math.round((tagged.size / target) * 100) : 100;
  console.log(`\n▶ FINITO — ${tagged.size}/${target} taggati (${finalPct}%) · ${upserted} nuovi in questa sessione`);
  await printDietStats();
}

void main();
