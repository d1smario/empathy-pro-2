/**
 * Smoke test Nutrition V2 end-to-end con catalogo USDA taggato (~5k+).
 * Requirements + substrati + pool GIN + composer draft.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { buildMealPlanV2Preview } from "../lib/nutrition/v2/build-meal-plan-v2-preview";
import type { IntelligentMealPlanRequest } from "../lib/nutrition/intelligent-meal-plan-types";

function loadEnvFile(filePath: string, override = false) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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
    process.env[key] = value.replace(/\\n/g, "").trim();
  }
}

const root = path.resolve(__dirname, "../../..");
loadEnvFile(path.join(root, ".env.local"), false);
loadEnvFile(path.join(root, "apps", "web", ".env.local"), true);

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const admin = createClient(url, key, { auth: { persistSession: false } });

const sampleRequest: IntelligentMealPlanRequest = {
  athleteId: "smoke-athlete-v2",
  planDate: new Date().toISOString().slice(0, 10),
  dietType: "mediterranean",
  trainingDayLines: ["Endurance 4h · 270W · carbo load"],
  slots: [
    {
      slot: "breakfast",
      labelIt: "Colazione",
      scheduledTimeLocal: "07:30",
      targetKcal: 650,
      targetCarbsG: 80,
      targetProteinG: 25,
      targetFatG: 18,
      functionalTargets: [],
      functionalFoodGroups: [],
      foodCandidates: [],
    },
    {
      slot: "lunch",
      labelIt: "Pranzo",
      scheduledTimeLocal: "13:00",
      targetKcal: 880,
      targetCarbsG: 110,
      targetProteinG: 40,
      targetFatG: 22,
      functionalTargets: [],
      functionalFoodGroups: [],
      foodCandidates: [],
    },
    {
      slot: "dinner",
      labelIt: "Cena",
      scheduledTimeLocal: "20:30",
      targetKcal: 700,
      targetCarbsG: 85,
      targetProteinG: 35,
      targetFatG: 20,
      functionalTargets: [],
      functionalFoodGroups: [],
      foodCandidates: [],
    },
  ],
  mealPlanSolverMeta: { dailyMealsKcalTotal: 2230, integrationLeverLines: [] },
};

async function main() {
  const { count: tagCount } = await admin
    .from("nutrition_fdc_food_tags")
    .select("fdc_id", { count: "exact", head: true });
  console.log(`\n=== Nutrition V2 smoke · tags in DB: ${tagCount ?? "?"} ===\n`);

  const preview = await buildMealPlanV2Preview(
    {
      request: sampleRequest,
      weightKg: 70,
      ftpWatts: 270,
      lifestyleActivityClass: "active",
      dietDayMealsScalePct: 100,
      plannedSessions: [{ label: "Endurance 4h · 270W", avgPowerW: 270, durationMin: 240 }],
      strategyKind: "load",
    },
    admin,
  );

  const r = preview.requirements;
  console.log("STRATEGIA:", r.strategyKind, "| dieta:", r.dietProfileActive);
  console.log("ENERGIA: BMR", r.energy.bmrKcal, "| lifestyle", r.energy.lifestyleKcal, "| training", r.energy.trainingKcal);
  console.log("SPLIT: pasti", r.energy.mealsKcal, "kcal | fueling CHO", r.energy.fuelingKcal, "kcal | daily", r.energy.dailyKcal);
  console.log(
    "STRATEGIA g/kg: CHO",
    r.dailyMacroTargetsGPerKg.choMinGPerKg,
    "-",
    r.dailyMacroTargetsGPerKg.choMaxGPerKg,
    "| PRO",
    r.dailyMacroTargetsGPerKg.proGPerKg,
    "| FAT",
    r.dailyMacroTargetsGPerKg.fatGPerKg,
  );
  if (r.substrateFueling?.sessions.length) {
    console.log("FUELING (substrati):");
    for (const s of r.substrateFueling.sessions) {
      console.log(
        `  ${s.sessionLabel}: burn ${s.choBurnedG}g CHO · intra ${s.intraChoG}g (${s.intraChoGPerH} g/h) · pre ${s.preChoG}g · post ${s.postChoG}g`,
      );
    }
  }
  console.log("MACRO totale: CHO", r.macros.total.choG, "g | PRO", r.macros.total.proG, "g | FAT", r.macros.total.fatG, "g");
  console.log("Substrati seduta:");
  for (const s of r.substrateRates) {
    console.log(`  ${s.sessionLabel}: ${s.choGPerH} g CHO/h · ${s.fatGPerH} g FAT/h · ${s.durationH} h`);
  }

  console.log("\nPOOL USDA per slot:");
  for (const pool of preview.foodPoolsBySlot) {
    console.log(`  ${pool.labelIt}: ${pool.candidates.length} candidati (${pool.filterSummary})`);
    if (pool.candidates[0]) {
      console.log(`    es. ${pool.candidates[0].description.slice(0, 55)}`);
    }
  }

  if (preview.dietMealSlotBudgets?.length) {
    console.log("\nSLOT PROFILE DIET:");
    for (const sl of preview.dietMealSlotBudgets) {
      console.log(`  ${sl.label}: ${sl.pct.toFixed(0)}% → ${sl.kcal} kcal`);
    }
  }

  console.log("\nBOZZA PIANO:");
  let sumKcal = 0;
  let sumCho = 0;
  let sumPro = 0;
  for (const slot of preview.composedMealPlan ?? []) {
    sumKcal += slot.totals.kcal;
    sumCho += slot.totals.choG;
    sumPro += slot.totals.proG;
    const item = slot.items[0];
    console.log(
      `  ${slot.labelIt}: ${item ? `${item.grams}g ${item.description.slice(0, 40)}` : "(vuoto)"} → ${slot.totals.kcal} kcal`,
    );
  }
  console.log(`\nTotale bozza pasti: ${Math.round(sumKcal)} kcal | CHO ${Math.round(sumCho)} g | PRO ${Math.round(sumPro)} g`);
  console.log(`Target meals kcal (requirements): ${r.energy.mealsKcal}`);
  console.log("\n=== Smoke OK ===\n");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
