/**
 * Smoke performance: calendario + nutrizione (Fase 1).
 * Usage (da root monorepo): node apps/web/scripts/perf-calendar-nutrition-smoke.mjs [athleteId]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const monoRoot = path.join(webRoot, "..", "..");

const DEFAULT_ATHLETE_ID = "bfacf0d5-6563-477a-8733-0a5146f04279";
const athleteId = (process.argv[2] ?? DEFAULT_ATHLETE_ID).trim();

function parseEnv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const ln of raw.split(/\r?\n/)) {
    const i = ln.indexOf("=");
    if (i <= 0) continue;
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[ln.slice(0, i).trim()] = v;
  }
  return env;
}

function loadSupabaseEnv() {
  const candidates = [
    path.join(webRoot, ".env.local"),
    path.join(monoRoot, ".env.local"),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const e = parseEnv(p);
    if (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) return e;
  }
  return null;
}

function runUnitTests() {
  const tests = [
    "lib/nutrition/nutrition-module-smoke.test.ts",
    "lib/nutrition/intelligent-meal-plan-system-interactions.test.ts",
    "lib/nutrition/meal-plan-memory-guardrail.test.ts",
    "lib/nutrition/race-day-pre-race-lunch.test.ts",
    "lib/nutrition/fueling-planned-session-analysis.test.ts",
    "modules/nutrition/services/nutrition-module-window-merge.test.ts",
  ];
  console.log("\n=== Unit smoke (node:test) ===");
  const r = spawnSync("npx", ["tsx", "--test", ...tests], {
    cwd: webRoot,
    stdio: "inherit",
    shell: true,
  });
  return r.status === 0;
}

function runDbSmoke() {
  console.log("\n=== DB smoke (Supabase + lib) ===");
  const r = spawnSync("npx", ["tsx", "scripts/perf-calendar-nutrition-smoke-db.ts", athleteId], {
    cwd: webRoot,
    stdio: "inherit",
    shell: true,
  });
  return r.status === 0;
}

async function probeDevHealth() {
  const port = process.env.EMPATHY_PRO2_DEV_PORT ?? "3020";
  const url = `http://127.0.0.1:${port}/api/health`;
  console.log("\n=== HTTP smoke (dev server, optional) ===");
  try {
    const t0 = performance.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const ms = Math.round(performance.now() - t0);
    console.log(`  [${res.ok ? "OK" : "WARN"}] GET ${url} → ${res.status} (${ms}ms)`);
    return res.ok;
  } catch {
    console.log(`  [SKIP] Dev non in ascolto su ${url} (avvia npm run dev per smoke HTTP)`);
    return true;
  }
}

async function main() {
  console.log("EMPATHY perf smoke — Calendar · Nutrition · Fueling");
  const unitOk = runUnitTests();
  if (!unitOk) {
    console.error("\nUnit smoke FAILED");
    process.exit(1);
  }

  const env = loadSupabaseEnv();
  if (!env) {
    console.warn("\n[WARN] Supabase env assente — skip DB smoke (solo unit test eseguiti)");
    await probeDevHealth();
    process.exit(0);
  }

  const dbOk = runDbSmoke();
  await probeDevHealth();

  if (!dbOk) {
    console.error("\nDB smoke FAILED");
    process.exit(1);
  }
  console.log("\n=== Smoke PASSED ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
