/**
 * Import bulk USDA Foundation + SR Legacy JSON → `nutrition_fdc_foods`.
 *
 * Prerequisito JSON in `data/usda-fdc/` (download: `scripts/download-usda-fdc-dumps.ps1` o `.sh`).
 * (cartella gitignored; vedi `docs/NUTRITION_FDC_LOCAL_CACHE.md`).
 *
 * Esecuzione (root monorepo):
 *   npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/import-usda-fdc-dump.ts --dry-run
 *   npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/import-usda-fdc-dump.ts
 *
 * Env: SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  buildNutritionFdcFoodUpsertPayloadFromUsdaRaw,
  parseUsdaDumpFoodRows,
  type NutritionFdcFoodUpsertPayload,
} from "../lib/nutrition/fdc-import-row";

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
    value = value.replace(/\r/g, "").replace(/\n/g, "").trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

const UPSERT_CHUNK = 8;
const UPSERT_MAX_RETRIES = 4;

/** `data/usda-fdc` vive nella root del monorepo, non in `apps/web`. */
function resolveMonorepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "data", "usda-fdc"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir);
}

function parseArgFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseArgNumber(name: string): number | null {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!hit) return null;
  const n = Number(hit.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function pickDumpJson(dir: string, kind: "foundation" | "sr_legacy"): string | null {
  const fallbacks =
    kind === "foundation"
      ? ["FoundationFoods.json", "foundation_food.json"]
      : ["SRLegacyFoods.json", "sr_legacy_food.json"];
  for (const name of fallbacks) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  if (!fs.existsSync(dir)) return null;
  const pattern = kind === "foundation" ? /foundation/i : /sr[_-]?legacy/i;
  const hit = fs.readdirSync(dir).find((f) => f.endsWith(".json") && pattern.test(f));
  return hit ? path.join(dir, hit) : null;
}

function resolveDumpPaths(root: string): string[] {
  const dir = path.join(root, "data", "usda-fdc");
  const foundation = pickDumpJson(dir, "foundation");
  const sr = pickDumpJson(dir, "sr_legacy");
  return [foundation, sr].filter((p): p is string => Boolean(p));
}

type DbUpsertRow = Record<string, unknown>;

function errMsg(error: { message?: string } | null | undefined): string {
  return String(error?.message ?? error ?? "unknown_error").slice(0, 200);
}

function toDbRow(row: NutritionFdcFoodUpsertPayload, includeMetabolic: boolean): DbUpsertRow {
  if (includeMetabolic) return row;
  const {
    glycemic_index_estimate: _gi,
    insulin_index_estimate: _ii,
    glycemic_load_100g: _gl,
    insulin_load_100g: _il,
    metabolic_indices: _mi,
    ...base
  } = row;
  return base;
}

async function upsertBatches(
  url: string,
  serviceRole: string,
  rows: NutritionFdcFoodUpsertPayload[],
): Promise<{ ok: number; fail: number; lastError?: string }> {
  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const probe = await admin.from("nutrition_fdc_foods").select("fdc_id").limit(1);
  if (probe.error?.code === "42P01" || probe.error?.message?.includes("does not exist")) {
    throw new Error(
      "Tabella nutrition_fdc_foods assente. Applica supabase/migrations/025_nutrition_fdc_food_cache.sql (SQL Editor o: npx supabase db query --linked -f supabase/migrations/025_nutrition_fdc_food_cache.sql).",
    );
  }

  let includeMetabolic = true;
  const probeRow: DbUpsertRow = {
    fdc_id: 999999990,
    description: "EMPATHY USDA import probe",
    data_type: "probe",
    publication_date: null,
    food_category: null,
    kcal_100g: 1,
    carbs_100g: 0,
    protein_100g: 0,
    fat_100g: 0,
    fiber_100g: null,
    sugars_100g: null,
    sodium_mg_100g: null,
    glycemic_index_estimate: 1,
    insulin_index_estimate: 1,
    glycemic_load_100g: 0,
    insulin_load_100g: 0,
    metabolic_indices: { probe: true },
    vitamins: [],
    minerals: [],
    amino_acids: [],
    fatty_acids: [],
    other_nutrients: [],
    nutrients_raw: [],
    source_payload: { probe: true },
    refreshed_at: new Date().toISOString(),
  };
  {
    const { error } = await admin.from("nutrition_fdc_foods").upsert([probeRow], { onConflict: "fdc_id" });
    if (error?.message?.includes("glycemic_index_estimate") || error?.code === "PGRST204") {
      includeMetabolic = false;
      console.log("▶ Colonne metaboliche assenti: upsert senza GI/II (applica migration 038 se le vuoi in DB).");
      const { glycemic_index_estimate: _a, insulin_index_estimate: _b, glycemic_load_100g: _c, insulin_load_100g: _d, metabolic_indices: _e, ...probeBase } =
        probeRow;
      const retry = await admin.from("nutrition_fdc_foods").upsert([probeBase], { onConflict: "fdc_id" });
      if (retry.error) {
        return { ok: 0, fail: rows.length, lastError: errMsg(retry.error) };
      }
    } else if (error) {
      return { ok: 0, fail: rows.length, lastError: errMsg(error) };
    }
    await admin.from("nutrition_fdc_foods").delete().eq("fdc_id", 999999990);
  }

  let ok = 0;
  let fail = 0;
  let lastError: string | undefined;
  const totalChunks = Math.ceil(rows.length / UPSERT_CHUNK);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK).map((r) => toDbRow(r, includeMetabolic));
    const chunkIndex = Math.floor(i / UPSERT_CHUNK) + 1;
    let done = false;
    for (let attempt = 1; attempt <= UPSERT_MAX_RETRIES; attempt += 1) {
      const { error } = await admin.from("nutrition_fdc_foods").upsert(chunk, { onConflict: "fdc_id" });
      if (!error) {
        done = true;
        break;
      }
      lastError = errMsg(error);
      const retryable =
        /network|connection|timeout|gateway|fetch failed|ECONNRESET/i.test(lastError) || error.code === "";
      if (!retryable || attempt === UPSERT_MAX_RETRIES) {
        fail += chunk.length;
        console.error(`▶ Chunk ${chunkIndex}/${totalChunks} FAIL (attempt ${attempt}): ${lastError}`);
        break;
      }
      await sleep(400 * attempt);
    }
    if (!done) break;
    ok += chunk.length;
    if (chunkIndex === 1 || chunkIndex % 25 === 0 || chunkIndex === totalChunks) {
      console.log(`▶ Upsert progress: ${ok}/${rows.length} (${chunkIndex}/${totalChunks} chunk)`);
    }
    await sleep(80);
  }
  return { ok, fail, lastError };
}

async function main() {
  const root = resolveMonorepoRoot(process.cwd());
  loadEnvFile(path.join(root, "apps", "web", ".env.local"));
  loadEnvFile(path.join(root, ".env.local"));

  const dryRun = parseArgFlag("--dry-run");
  const limit = parseArgNumber("--limit");
  const dumpPaths = resolveDumpPaths(root);
  if (dumpPaths.length === 0) {
    throw new Error(
      "Nessun file JSON in data/usda-fdc/. Scarica Foundation + SR Legacy da USDA e posiziona FoundationFoods.json e SRLegacyFoods.json.",
    );
  }

  const payloads: NutritionFdcFoodUpsertPayload[] = [];
  const seenIds = new Set<number>();
  let skipped = 0;
  let buildErrors = 0;

  for (const filePath of dumpPaths) {
    const tag = path.basename(filePath, ".json");
    const rawJson = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
    const rows = parseUsdaDumpFoodRows(rawJson);
    console.log(`▶ ${tag}: ${rows.length} righe nel file`);
    for (const row of rows) {
      if (limit != null && payloads.length >= limit) break;
      const built = buildNutritionFdcFoodUpsertPayloadFromUsdaRaw(row, {
        sourceTag: `usda_dump_${tag}`,
      });
      if ("error" in built) {
        buildErrors += 1;
        continue;
      }
      if (seenIds.has(built.fdc_id)) {
        skipped += 1;
        continue;
      }
      seenIds.add(built.fdc_id);
      payloads.push(built);
    }
    if (limit != null && payloads.length >= limit) break;
  }

  console.log(`▶ Payload pronti: ${payloads.length} (build error: ${buildErrors}, dup skip: ${skipped})`);

  if (dryRun) {
    console.log("▶ Dry-run: nessun upsert Supabase.");
    return;
  }

  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!supabaseUrl || !serviceRole) {
    throw new Error("SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY richiesti per upsert.");
  }

  console.log(`▶ Supabase host: ${new URL(supabaseUrl).host}`);
  const result = await upsertBatches(supabaseUrl, serviceRole, payloads);
  console.log(`▶ Upsert: ${result.ok} ok · ${result.fail} fail${result.lastError ? ` · ${result.lastError}` : ""}`);
  if (result.fail > 0) process.exitCode = 1;
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
