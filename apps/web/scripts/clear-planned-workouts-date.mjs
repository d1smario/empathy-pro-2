/**
 * Elimina tutte le righe `planned_workouts` per una data (default 2026-05-27).
 * Uso: node scripts/clear-planned-workouts-date.mjs [YYYY-MM-DD] [athlete_id]
 * Legge credenziali da apps/web/.env.local (non stampare valori segreti).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");

function parseEnv(p) {
  const raw = fs.readFileSync(p, "utf8");
  const env = {};
  for (const ln of raw.split(/\r?\n/)) {
    const i = ln.indexOf("=");
    if (i <= 0) continue;
    const k = ln.slice(0, i).trim();
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/\\n/g, "").trim();
    env[k] = v;
  }
  return env;
}

const targetDate = (process.argv[2] ?? "2026-05-27").slice(0, 10);
const athleteIdFilter = (process.argv[3] ?? "").trim();

const envCandidates = [
  path.join(__dirname, "..", ".env.local"),
  path.join(__dirname, "..", "..", "..", ".env.local"),
  path.join(__dirname, "..", ".env.local.production"),
  path.join(__dirname, "..", ".env.vercel.local"),
];

let env = null;
for (const p of envCandidates) {
  if (!fs.existsSync(p)) continue;
  env = parseEnv(p);
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) break;
}
if (!env?.NEXT_PUBLIC_SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase URL or service role key in .env.local / .env.local.production / .env.vercel.local");
  process.exit(1);
}

const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;

const headers = { apikey: key, Authorization: `Bearer ${key}` };

let listUrl = `${base}/rest/v1/planned_workouts?date=eq.${encodeURIComponent(targetDate)}&select=id,athlete_id,type,duration_minutes,tss_target,kcal_target`;
if (athleteIdFilter) listUrl += `&athlete_id=eq.${encodeURIComponent(athleteIdFilter)}`;

const listRes = await fetch(listUrl, { headers });
if (!listRes.ok) {
  console.error("List failed:", listRes.status, await listRes.text());
  process.exit(1);
}
const rows = await listRes.json();
if (!Array.isArray(rows)) {
  console.error("Unexpected response:", rows);
  process.exit(1);
}

console.log(`Date ${targetDate}: found ${rows.length} planned_workout(s)`);
for (const r of rows) {
  console.log(`  id=${r.id} athlete=${r.athlete_id} type=${r.type} dur=${r.duration_minutes} tss=${r.tss_target}`);
}

if (rows.length === 0) {
  console.log("Nothing to delete.");
  process.exit(0);
}

let delUrl = `${base}/rest/v1/planned_workouts?date=eq.${encodeURIComponent(targetDate)}`;
if (athleteIdFilter) delUrl += `&athlete_id=eq.${encodeURIComponent(athleteIdFilter)}`;

const delRes = await fetch(delUrl, {
  method: "DELETE",
  headers: { ...headers, Prefer: "return=representation" },
});
if (!delRes.ok) {
  console.error("Delete failed:", delRes.status, await delRes.text());
  process.exit(1);
}
const deleted = await delRes.json();
console.log(`Deleted ${Array.isArray(deleted) ? deleted.length : "?"} row(s).`);
