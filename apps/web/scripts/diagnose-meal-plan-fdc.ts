/**
 * Diagnosi end-to-end del pipeline meal plan ↔ cache USDA.
 *
 * Senza fare richieste a USDA o lanciare il server Next, simula i passi che il route
 * `/api/nutrition/intelligent-meal-plan` esegue:
 *   1. Per una lista di item-tipo (nomi italiani che il pipeline genera), risolve `canonicalKey`
 *      via `inferCanonicalFoodKey`.
 *   2. Per ogni canonicalKey con `fdcId` mappato in `canonical-food-fdc-aliases.ts`, legge il record
 *      dalla cache Supabase `nutrition_fdc_foods` (no fallback USDA).
 *   3. Applica `nutrientsForMealPlanItemFromCache` con lo snapshot.
 *   4. Stampa righe colorate con `compositionStatus`, kcal, alcuni micro-key, GI/II.
 *
 * Risultato atteso (dopo il bulk warmer): la maggior parte degli item devono uscire con
 * `compositionStatus: "fdc_cache"` e micronutrienti ≠ 0.
 *
 * Esecuzione (root monorepo):
 *   npx tsx apps/web/scripts/diagnose-meal-plan-fdc.ts
 */

import fs from "node:fs";
import path from "node:path";
import { inferCanonicalFoodKey } from "../lib/nutrition/canonical-food-composition";
import {
  CANONICAL_FOOD_TO_FDC_ID,
} from "../lib/nutrition/canonical-food-fdc-aliases";

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

const PROBE_ITEMS: Array<{ name: string; portionHint: string; approxKcal: number }> = [
  { name: "Yogurt greco bianco", portionHint: "150 g", approxKcal: 90 },
  { name: "Pasta integrale al pomodoro", portionHint: "80 g pasta cruda", approxKcal: 290 },
  { name: "Riso basmati", portionHint: "70 g cotto", approxKcal: 90 },
  { name: "Petto di pollo grigliato", portionHint: "120 g", approxKcal: 180 },
  { name: "Salmone al forno", portionHint: "120 g", approxKcal: 270 },
  { name: "Lenticchie cotte", portionHint: "150 g", approxKcal: 175 },
  { name: "Insalata mista verdura", portionHint: "150 g", approxKcal: 35 },
  { name: "Banana", portionHint: "1 frutto medio (120 g)", approxKcal: 105 },
  { name: "Mela", portionHint: "1 frutto (150 g)", approxKcal: 80 },
  { name: "Avocado", portionHint: "1/2 frutto (75 g)", approxKcal: 120 },
  { name: "Olio extra vergine di oliva", portionHint: "10 ml", approxKcal: 80 },
  { name: "Pane integrale", portionHint: "60 g", approxKcal: 150 },
  { name: "Uova", portionHint: "2 uova (110 g)", approxKcal: 155 },
  { name: "Mandorle", portionHint: "20 g", approxKcal: 115 },
  { name: "Bresaola", portionHint: "60 g", approxKcal: 90 },
];

async function fetchAllFromCache(supabaseUrl: string, serviceRole: string, fdcIds: number[]) {
  if (fdcIds.length === 0) return new Map<number, Record<string, unknown>>();
  const inClause = fdcIds.join(",");
  const url = `${supabaseUrl}/rest/v1/nutrition_fdc_foods?fdc_id=in.(${inClause})&select=*`;
  const res = await fetch(url, {
    headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
  });
  if (!res.ok) throw new Error(`Supabase select failed ${res.status}: ${await res.text()}`);
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  const map = new Map<number, Record<string, unknown>>();
  for (const r of rows) {
    const id = Number(r.fdc_id);
    if (Number.isFinite(id)) map.set(id, r);
  }
  return map;
}

async function main() {
  const root = process.cwd();
  loadEnvFile(path.join(root, "apps", "web", ".env.local"));
  loadEnvFile(path.join(root, ".env.local"));
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl) throw new Error("SUPABASE_URL non configurata");
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata");

  console.log("▶ Test 1: inferCanonicalFoodKey per ogni item probe");
  console.log("─".repeat(110));
  const inferred: Array<{ item: typeof PROBE_ITEMS[number]; key: string; fdcId: number | undefined }> = [];
  for (const it of PROBE_ITEMS) {
    const key = inferCanonicalFoodKey(`${it.name} ${it.portionHint}`);
    const fdcId = CANONICAL_FOOD_TO_FDC_ID[key];
    inferred.push({ item: it, key, fdcId });
    console.log(`  ${it.name.padEnd(40)} → key=${key.padEnd(18)} fdcId=${fdcId ?? "—"}`);
  }

  const fdcIds = Array.from(new Set(inferred.map((r) => r.fdcId).filter((v): v is number => typeof v === "number")));
  console.log(`\n▶ Test 2: lookup ${fdcIds.length} fdcId distinti in cache Supabase`);
  console.log("─".repeat(110));
  const cacheRows = await fetchAllFromCache(supabaseUrl, serviceRole, fdcIds);
  console.log(`  Trovati in cache: ${cacheRows.size}/${fdcIds.length}`);
  for (const fid of fdcIds) {
    const row = cacheRows.get(fid);
    if (!row) {
      console.log(`  ✘ fdcId=${fid}: NON TROVATO IN CACHE`);
    } else {
      const kcal = Number(row.kcal_100g ?? 0);
      const vits = Array.isArray(row.vitamins) ? row.vitamins.length : 0;
      const minz = Array.isArray(row.minerals) ? row.minerals.length : 0;
      const aas = Array.isArray(row.amino_acids) ? row.amino_acids.length : 0;
      const fas = Array.isArray(row.fatty_acids) ? row.fatty_acids.length : 0;
      const gi = Number(row.glycemic_index_estimate ?? 0);
      console.log(
        `  ✓ fdcId=${String(fid).padEnd(8)} kcal100=${String(kcal.toFixed(1)).padStart(6)}  vits=${vits}  minz=${minz}  AAs=${aas}  FAs=${fas}  GI=${gi.toFixed(1)}  ${String(row.description).slice(0, 50)}`,
      );
    }
  }

  console.log(`\n▶ Test 3: simulazione runtime end-to-end`);
  console.log("─".repeat(110));
  const totalProbed = inferred.length;
  const resolvedCacheCount = inferred.filter((r) => r.fdcId && cacheRows.has(r.fdcId)).length;
  const tsOnlyCount = inferred.filter((r) => r.key !== "generic_mixed" && (!r.fdcId || !cacheRows.has(r.fdcId))).length;
  const unresolvedCount = inferred.filter((r) => r.key === "generic_mixed").length;
  console.log(`  ${totalProbed} item probe → ${resolvedCacheCount} fdc_cache · ${tsOnlyCount} canonical_estimate · ${unresolvedCount} unresolved`);

  if (resolvedCacheCount === 0) {
    console.log("\n  ⚠️  NESSUN ITEM RISOLVE VIA CACHE USDA — possibili cause:");
    console.log("     - `inferCanonicalFoodKey` non riconosce i nomi degli item (vedi Test 1)");
    console.log("     - le canonicalKey inferite non sono mappate in CANONICAL_FOOD_TO_FDC_ID");
    console.log("     - i fdcId mappati non sono presenti in nutrition_fdc_foods (rilancia warm-usda-bulk.ts)");
  }
}

void main().catch((err) => {
  console.error(`Errore diagnose: ${(err as Error).message}`);
  process.exit(1);
});
