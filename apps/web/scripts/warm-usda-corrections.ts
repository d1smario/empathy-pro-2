/**
 * Correzioni mirate alla cache USDA quando il ranking di `foods/search` privilegia
 * matches semantici sbagliati (es. "Chickpeas, mature seeds, cooked, boiled, without salt"
 * → match Lentils per parole comuni).
 *
 * Per ogni FIX:
 *   - cerca su USDA con dataType filtrato
 *   - filtra i risultati con `mustContain` (tutte le keyword devono comparire) e `mustNotContain`
 *   - prende il primo hit valido
 *   - importa via stessa pipeline del bulk warmer
 *   - aggiorna il file `.warm-usda-bulk-aliases.json`
 *
 * Esecuzione:
 *   npx tsx apps/web/scripts/warm-usda-corrections.ts
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

type FixSpec = {
  id: string;
  query: string;
  dataType?: string;
  mustContain: string[];
  mustNotContain?: string[];
};

const FIXES: FixSpec[] = [
  {
    id: "artichoke_raw",
    query: "Artichokes globe french",
    dataType: "SR Legacy",
    mustContain: ["artichoke"],
    mustNotContain: ["jerusalem"],
  },
  {
    id: "chickpeas_cooked",
    query: "Chickpeas garbanzo beans cooked boiled",
    dataType: "SR Legacy",
    mustContain: ["chickpea"],
    mustNotContain: ["lentil", "soybean", "bean, kidney"],
  },
  {
    id: "cheese_cheddar",
    query: "Cheese cheddar",
    dataType: "SR Legacy",
    mustContain: ["cheddar"],
    mustNotContain: ["imitation", "low fat", "low-sodium"],
  },
  {
    id: "tuna_canned_water",
    query: "Fish tuna light canned water drained",
    dataType: "SR Legacy",
    mustContain: ["tuna", "water"],
    mustNotContain: ["in oil"],
  },
  {
    id: "yogurt_plain",
    query: "Yogurt plain whole milk",
    dataType: "SR Legacy",
    mustContain: ["yogurt", "plain"],
    mustNotContain: ["fruit", "flavor", "vanilla", "strawberry", "low fat"],
  },
  {
    id: "oats_raw",
    query: "Oats regular quick dry",
    dataType: "SR Legacy",
    mustContain: ["oats"],
    mustNotContain: ["oat bran", "instant", "fortified", "ready-to-eat", "cooked"],
  },
];

type SearchHit = { fdcId: number; description: string; dataType?: string };

async function searchFiltered(apiKey: string, fix: FixSpec): Promise<SearchHit | null> {
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("query", fix.query);
  url.searchParams.set("pageSize", "25");
  url.searchParams.set("dataType", fix.dataType ?? "Foundation,SR Legacy");
  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const foods = Array.isArray(data?.foods) ? (data.foods as Array<Record<string, unknown>>) : [];

  const must = fix.mustContain.map((k) => k.toLowerCase());
  const mustNot = (fix.mustNotContain ?? []).map((k) => k.toLowerCase());

  for (const row of foods) {
    const id = Number(row.fdcId);
    if (!Number.isFinite(id) || id < 1) continue;
    const description = String(row.description ?? "").trim();
    const lower = description.toLowerCase();
    if (!must.every((k) => lower.includes(k))) continue;
    if (mustNot.some((k) => lower.includes(k))) continue;
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

async function importFood(apiKey: string, fdcId: number, supabaseUrl: string, serviceRole: string) {
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
      source: "warm_usda_corrections_v1",
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
    source_payload: { warmupCorrection: "warm_usda_corrections_v1", fdcId: raw.fdcId ?? fdcId },
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

  const apiKey = process.env.USDA_API_KEY?.trim();
  if (!apiKey) throw new Error("USDA_API_KEY non configurata in .env.local");
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!supabaseUrl) throw new Error("SUPABASE_URL non configurata");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata");

  const reportPath = path.join(root, "apps", "web", "scripts", "usda-bulk-aliases.json");
  const report = fs.existsSync(reportPath)
    ? (JSON.parse(fs.readFileSync(reportPath, "utf8")) as { aliases: Record<string, { fdcId: number; description: string; dataType?: string }>; ok: number; fail: number; skipped: number; total: number; failed?: Array<{ id: string; reason: string }> })
    : { aliases: {}, ok: 0, fail: 0, skipped: 0, total: 0, failed: [] };

  console.log(`▶ Correzioni puntuali: ${FIXES.length} alimenti.`);
  let fixed = 0;
  for (let i = 0; i < FIXES.length; i++) {
    const fix = FIXES[i];
    const prefix = `[${String(i + 1).padStart(2, " ")}/${FIXES.length}]`;
    try {
      const hit = await searchFiltered(apiKey, fix);
      if (!hit) {
        console.log(`${prefix} — ${fix.id}: nessun match con vincoli mustContain=${fix.mustContain.join("+")}`);
        continue;
      }
      const result = await importFood(apiKey, hit.fdcId, supabaseUrl, serviceRole);
      if ("error" in result) {
        console.log(`${prefix} ✘ ${fix.id}: ${hit.fdcId} import error → ${result.error}`);
        continue;
      }
      console.log(`${prefix} ✓ ${fix.id}: ${hit.fdcId} (${result.dataType ?? "?"}) ${result.description.slice(0, 70)}`);
      report.aliases[fix.id] = { fdcId: hit.fdcId, description: result.description, dataType: result.dataType ?? undefined };
      fixed += 1;
    } catch (err) {
      console.log(`${prefix} ✘ ${fix.id}: EXC ${(err as Error).message.slice(0, 100)}`);
    }
    await sleep(200);
  }

  fs.writeFileSync(reportPath, JSON.stringify({ ...report, generatedAt: new Date().toISOString() }, null, 2));
  console.log(`\n▶ Correzioni applicate: ${fixed}/${FIXES.length}.`);
  console.log(`▶ Report aggiornato: ${reportPath}`);
}

void main().catch((err) => {
  console.error(`Errore corrections: ${(err as Error).message}`);
  process.exit(1);
});
