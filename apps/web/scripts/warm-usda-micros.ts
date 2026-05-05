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

async function main() {
  const root = process.cwd();
  loadEnvFile(path.join(root, ".env.local.production"));
  loadEnvFile(path.join(root, "apps", "web", ".env.local"));

  if (!process.env.USDA_API_KEY?.trim()) {
    throw new Error("USDA_API_KEY non configurata.");
  }
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata.");
  }
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL non configurata.");
  }

  const ids = [
    171688, // spinach
    173686, // salmon atlantic
    172421, // lentils boiled
    171711, // blueberries
    173944, // greek yogurt plain
    170567, // almonds
    173410, // oats
    173757, // sweet potato
    175034, // chickpeas
    173695, // sardines
    169910, // avocado
    170379, // eggs
  ];

  let ok = 0;
  let fail = 0;
  const usdaApiKey = process.env.USDA_API_KEY.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();

  const toNum = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const compact = (nutrients: Array<Record<string, unknown>>): FdcMicroPer100g[] =>
    nutrients
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

  for (const id of ids) {
    const usdaRes = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${id}?api_key=${encodeURIComponent(usdaApiKey)}`, {
      cache: "no-store",
    }).catch(() => null);
    if (!usdaRes?.ok) {
      fail += 1;
      console.log(`FAIL ${id}: USDA request failed (${usdaRes?.status ?? "no-response"})`);
      continue;
    }
    const raw = (await usdaRes.json()) as Record<string, unknown>;
    const nutrients = (Array.isArray(raw.foodNutrients) ? raw.foodNutrients : []) as Array<Record<string, unknown>>;
    const macro = summarizePer100gFromFdcNutrientRows(nutrients);
    const compactRows = compact(nutrients);
    const parts = partitionFdcNutrientsFromCompact(compactRows);
    const payload = {
      fdc_id: id,
      description: String(raw.description ?? `FDC ${id}`),
      data_type: raw.dataType != null ? String(raw.dataType) : null,
      publication_date: raw.publicationDate != null ? String(raw.publicationDate) : null,
      food_category: raw.foodCategory != null ? String(raw.foodCategory) : null,
      kcal_100g: Math.max(0, macro.kcalPer100g ?? 0),
      carbs_100g: Math.max(0, macro.carbsPer100g ?? 0),
      protein_100g: Math.max(0, macro.proteinPer100g ?? 0),
      fat_100g: Math.max(0, macro.fatPer100g ?? 0),
      sodium_mg_100g: macro.sodiumMgPer100g,
      vitamins: parts.vitamins,
      minerals: parts.minerals,
      amino_acids: parts.aminoAcids,
      fatty_acids: parts.fattyAcids,
      other_nutrients: parts.other,
      nutrients_raw: compactRows,
      source_payload: {
        warmup: "usda_micros_script_v1",
        fdcId: raw.fdcId ?? id,
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
      fail += 1;
      console.log(`FAIL ${id}: upsert failed ${upsertRes?.status ?? "no-response"} ${errText.slice(0, 120)}`);
      continue;
    }
    ok += 1;
    console.log(`OK   ${id}: ${payload.description}`);
  }

  console.log(`\nWarmup completato: ${ok} ok, ${fail} fail, totale ${ids.length}.`);
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Errore warmup USDA: ${message}`);
  process.exit(1);
});
