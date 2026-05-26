/**
 * Diagnostica planned/executed per atleta (nome o id).
 * Usage: node scripts/diag-athlete-window.mjs [athleteIdOrNameFragment]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseEnv(p) {
  const raw = fs.readFileSync(p, "utf8");
  const env = {};
  for (const ln of raw.split(/\r?\n/)) {
    const i = ln.indexOf("=");
    if (i <= 0) continue;
    const k = ln.slice(0, i).trim();
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
  return env;
}

const envCandidates = [
  path.join(__dirname, "..", ".env.local"),
  path.join(__dirname, "..", "..", "..", ".env.local"),
];
let env = null;
for (const p of envCandidates) {
  if (!fs.existsSync(p)) continue;
  env = parseEnv(p);
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) break;
}
if (!env?.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function rest(pathAndQuery) {
  const r = await fetch(`${base}/rest/v1/${pathAndQuery}`, { headers });
  const j = await r.json();
  return { status: r.status, data: j };
}

const needle = (process.argv[2] ?? "calcagni").toLowerCase();
const from = process.argv[3] ?? "2026-05-20";
const to = process.argv[4] ?? "2026-05-31";

const apRes = await rest(
  `athlete_profiles?select=id,email,first_name,last_name&limit=200`,
);
const athletes = Array.isArray(apRes.data) ? apRes.data : [];
const matches = athletes.filter((a) => {
  const blob = `${a.first_name ?? ""} ${a.last_name ?? ""} ${a.email ?? ""} ${a.id}`.toLowerCase();
  return blob.includes(needle) || a.id === needle;
});

console.log(`Matches for "${needle}":`, matches.length);
for (const a of matches) {
  console.log(`  ${a.id} | ${a.first_name ?? ""} ${a.last_name ?? ""} | ${a.email ?? ""}`);
}

const athleteId = matches[0]?.id ?? needle;
if (!/^[0-9a-f-]{36}$/i.test(athleteId)) {
  console.error("No athlete id resolved");
  process.exit(1);
}

const prefs = await rest(`athlete_data_source_preference?athlete_id=eq.${athleteId}&select=domain,primary_provider`);
console.log("\nPreferences:", prefs.data);

const ex = await rest(
  `executed_workouts?athlete_id=eq.${athleteId}&date=gte.${from}&date=lte.${to}&select=id,date,source,duration_minutes,tss,kcal&order=date.asc`,
);
console.log(`\nExecuted ${from}..${to}:`, Array.isArray(ex.data) ? ex.data.length : ex.data);
for (const r of ex.data ?? []) {
  console.log(`  ${r.date} src=${r.source} dur=${r.duration_minutes} tss=${r.tss}`);
}

const pl = await rest(
  `planned_workouts?athlete_id=eq.${athleteId}&date=gte.${from}&date=lte.${to}&select=id,date,type,duration_minutes,tss_target&order=date.asc`,
);
console.log(`\nPlanned ${from}..${to}:`, Array.isArray(pl.data) ? pl.data.length : pl.data);
for (const r of pl.data ?? []) {
  console.log(`  ${r.date} ${r.type} dur=${r.duration_minutes} tss=${r.tss_target}`);
}
