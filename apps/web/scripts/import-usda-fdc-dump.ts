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

const UPSERT_CHUNK = 25;
const UPSERT_MAX_RETRIES = 5;
const UPSERT_CHUNK_DELAY_MS = 120;

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

  let includeMetabolic = true;
  let ok = 0;
  let fail = 0;
  let lastError: string | undefined;
  const totalChunks = Math.ceil(rows.length / UPSERT_CHUNK);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunkIndex = Math.floor(i / UPSERT_CHUNK) + 1;
    let chunk = rows.slice(i, i + UPSERT_CHUNK).map((r) => toDbRow(r, includeMetabolic));
    let persisted = false;

    for (let attempt = 1; attempt <= UPSERT_MAX_RETRIES; attempt += 1) {
      const res = await admin
        .from("nutrition_fdc_foods")
        .upsert(chunk, { onConflict: "fdc_id" })
        .select("fdc_id");

      if (res.error) {
        lastError = errMsg(res.error);
        if (
          includeMetabolic &&
          (res.error.message?.includes("glycemic_index_estimate") || res.error.code === "PGRST204")
        ) {
          includeMetabolic = false;
          chunk = rows.slice(i, i + UPSERT_CHUNK).map((r) => toDbRow(r, false));
          continue;
        }
        const retryable =
          /network|connection|timeout|gateway|fetch failed|ECONNRESET/i.test(lastError) ||
          res.error.code === "";
        if (!retryable || attempt === UPSERT_MAX_RETRIES) {
          fail += chunk.length;
          console.error(`▶ Chunk ${chunkIndex}/${totalChunks} FAIL (attempt ${attempt}): ${lastError}`);
          break;
        }
        await sleep(400 * attempt);
        continue;
      }

      const returned = res.data?.length ?? 0;
      if (returned > 0) {
        persisted = true;
        break;
      }

      lastError = `upsert senza righe restituite (status ${res.status})`;
      if (attempt === UPSERT_MAX_RETRIES) {
        fail += chunk.length;
        console.error(`▶ Chunk ${chunkIndex}/${totalChunks} FAIL: ${lastError}`);
      } else {
        await sleep(500 * attempt);
      }
    }

    if (!persisted) continue;
    ok += chunk.length;
    if (chunkIndex === 1 || chunkIndex % 50 === 0 || chunkIndex === totalChunks) {
      console.log(`▶ Upsert progress: ${ok}/${rows.length} (${chunkIndex}/${totalChunks} chunk)`);
    }
    await sleep(UPSERT_CHUNK_DELAY_MS);
  }

  return { ok, fail, lastError };
}

async function main() {
  const root = resolveMonorepoRoot(process.cwd());
  const envRoot = path.resolve(__dirname, "../../..");
  loadEnvFile(path.join(envRoot, ".env.local"), false);
  loadEnvFile(path.join(envRoot, "apps", "web", ".env.local"), true);

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

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "")
    .trim()
    .replace(/\/$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!supabaseUrl || !serviceRole) {
    throw new Error("SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY richiesti per upsert.");
  }

  console.log(`▶ Supabase host: ${new URL(supabaseUrl).host}`);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { count: beforeCount } = await admin
    .from("nutrition_fdc_foods")
    .select("fdc_id", { count: "exact", head: true });
  console.log(`▶ Count prima import: ${beforeCount ?? "?"}`);

  const result = await upsertBatches(supabaseUrl, serviceRole, payloads);
  console.log(`▶ Upsert: ${result.ok} ok · ${result.fail} fail${result.lastError ? ` · ${result.lastError}` : ""}`);

  const { count: afterCount, error: countErr } = await admin
    .from("nutrition_fdc_foods")
    .select("fdc_id", { count: "exact", head: true });
  const probeId = payloads[0]?.fdc_id;
  const { data: probeRow } =
    probeId != null
      ? await admin.from("nutrition_fdc_foods").select("fdc_id").eq("fdc_id", probeId).maybeSingle()
      : { data: null };
  const srLegacyProbe = 167512;
  const { data: srRow } = await admin.from("nutrition_fdc_foods").select("fdc_id").eq("fdc_id", srLegacyProbe).maybeSingle();
  console.log(`▶ Post-import count in DB: ${afterCount ?? "?"}${countErr ? ` (${countErr.message})` : ""}`);
  if (probeId != null) {
    console.log(`▶ Probe fdc_id ${probeId} presente: ${probeRow ? "sì" : "NO"}`);
  }
  console.log(`▶ Probe SR Legacy fdc_id ${srLegacyProbe}: ${srRow ? "sì" : "NO"}`);
  const expectedMin = Math.max(7000, payloads.length - 50);
  if (afterCount != null && afterCount < expectedMin) {
    console.error(
      `▶ ATTENZIONE: count DB ${afterCount} sotto atteso ~${payloads.length}. Verifica URL+SERVICE_ROLE stesso progetto Supabase.`,
    );
    process.exitCode = 1;
  }
  if (result.fail > 0) process.exitCode = 1;
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
