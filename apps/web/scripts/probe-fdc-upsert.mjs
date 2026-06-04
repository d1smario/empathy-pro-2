/**
 * One-row upsert probe (no secrets logged). Run from monorepo root:
 *   node apps/web/scripts/probe-fdc-upsert.mjs
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function resolveMonorepoRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "data", "usda-fdc")) || fs.existsSync(path.join(dir, "apps", "web"))) {
      if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir);
}

const root = resolveMonorepoRoot(process.cwd());
loadEnvFile(path.join(root, "apps", "web", ".env.local"));
loadEnvFile(path.join(root, ".env.local"));
const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
if (!supabaseUrl || !serviceRole) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const host = new URL(supabaseUrl).host;
console.log("supabase host:", host);
console.log("service role configured:", serviceRole.length > 20);

const payload = [
  {
    fdc_id: 999999991,
    description: "EMPATHY FDC import probe",
    data_type: "probe",
    publication_date: null,
    food_category: null,
    kcal_100g: 100,
    carbs_100g: 10,
    protein_100g: 5,
    fat_100g: 2,
    fiber_100g: 1,
    sugars_100g: 0,
    sodium_mg_100g: 50,
    glycemic_index_estimate: 40,
    insulin_index_estimate: 45,
    glycemic_load_100g: 5,
    insulin_load_100g: 6,
    metabolic_indices: { method: "probe" },
    vitamins: [],
    minerals: [],
    amino_acids: [],
    fatty_acids: [],
    other_nutrients: [],
    nutrients_raw: [],
    source_payload: { probe: true },
    refreshed_at: new Date().toISOString(),
  },
];

const res = await fetch(`${supabaseUrl}/rest/v1/nutrition_fdc_foods?on_conflict=fdc_id`, {
  method: "POST",
  headers: {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log("status:", res.status, res.statusText);
console.log("body:", text.slice(0, 800));
