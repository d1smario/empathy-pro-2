/**
 * DB leg dello smoke perf (import @/ via tsx).
 * Solo queryPlannedExecutedWindow — evita server-only di athlete memory.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { queryPlannedExecutedWindow } from "@/lib/training/planned-executed-window-query";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const monoRoot = path.join(webRoot, "..", "..");

const DEFAULT_ATHLETE_ID = "bfacf0d5-6563-477a-8733-0a5146f04279";
const athleteId = (process.argv[2] ?? DEFAULT_ATHLETE_ID).trim();

function parseEnv(filePath: string) {
  const raw = fs.readFileSync(filePath, "utf8");
  const env: Record<string, string> = {};
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
  for (const p of [path.join(webRoot, ".env.local"), path.join(monoRoot, ".env.local")]) {
    if (!fs.existsSync(p)) continue;
    const e = parseEnv(p);
    if (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) return e;
  }
  return null;
}

function isoDayOffset(anchorIso: string, deltaDays: number) {
  const base = new Date(`${anchorIso}T12:00:00`);
  base.setDate(base.getDate() + deltaDays);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function main() {
  const env = loadSupabaseEnv();
  if (!env) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL.trim(), env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = new Date().toISOString().slice(0, 10);
  const from7 = isoDayOffset(today, -7);
  const to7 = isoDayOffset(today, 7);
  const from30 = isoDayOffset(today, -30);
  const to30 = isoDayOffset(today, 30);

  const cases = [
    { label: "planned-window lite ±7d", from: from7, to: to7, trace: false },
    { label: "planned-window lite ±30d", from: from30, to: to30, trace: false },
    { label: "planned-window trace 1d", from: today, to: today, trace: true },
  ];

  console.log("\n=== DB smoke (queryPlannedExecutedWindow) ===");
  console.log("athleteId:", athleteId);

  let ok = true;
  for (const c of cases) {
    const t0 = performance.now();
    const res = await queryPlannedExecutedWindow(db, athleteId, c.from, c.to, {}, {
      includeTraceSummary: c.trace,
    });
    const ms = Math.round(performance.now() - t0);
    const err = res.planned.error?.message ?? res.executed.error?.message ?? null;
    const plannedN = res.planned.data?.length ?? 0;
    const executedN = res.executed.data?.length ?? 0;
    const status = err ? "FAIL" : "OK";
    if (err) ok = false;
    console.log(`  [${status}] ${c.label}: ${ms}ms planned=${plannedN} executed=${executedN}${err ? ` err=${err}` : ""}`);
  }

  console.log("\n  (day-hub: verificato via typecheck + route GET in dev con auth)");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
