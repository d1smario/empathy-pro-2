import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
function parseEnv(p) {
  const raw = fs.readFileSync(p, "utf8");
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
const envCandidates = [
  path.join(root, "apps", "web", ".env.local"),
  path.join(root, ".env.local"),
  path.join(root, ".env.local.production"),
];
let env = null;
for (const p of envCandidates) {
  if (!fs.existsSync(p)) continue;
  const e = parseEnv(p);
  if (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) { env = e; break; }
}
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\\[rn]/g, "").trim().replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY.replace(/\\[rn]/g, "").trim();
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function get(pathq) {
  const res = await fetch(`${base}/rest/v1/${pathq}`, { headers });
  const t = await res.text();
  try { return JSON.parse(t); } catch { return t; }
}

const AID = "bfacf0d5-6563-477a-8733-0a5146f04279"; // Nicola Giustacchini

console.log("== athlete_data_source_preference ==");
console.log(JSON.stringify(await get(`athlete_data_source_preference?athlete_id=eq.${AID}&select=domain,primary_provider`), null, 2));

console.log("\n== planned_workouts 2026-05-31 (RAW) ==");
const p31 = await get(`planned_workouts?athlete_id=eq.${AID}&date=eq.2026-05-31&select=id,type,date,duration_minutes,tss_target,kcal_target,created_at,notes`);
console.log(JSON.stringify(p31, null, 2));
if (Array.isArray(p31)) {
  for (const r of p31) {
    const n = String(r.notes ?? "");
    const strictEq = r.date === "2026-05-31";
    const sliceEq = String(r.date ?? "").slice(0, 10) === "2026-05-31";
    const nameMatch = n.match(/"sessionName"\s*:\s*"([^"]+)"/);
    console.log(
      `  ${r.id?.slice(0, 8)} type=${r.type} date=${JSON.stringify(r.date)} strictEq=${strictEq} sliceEq=${sliceEq} session=${nameMatch?.[1] ?? "?"}`,
    );
  }
}

console.log("\n== coach_athletes (chi può leggere come coach) ==");
console.log(JSON.stringify(await get(`coach_athletes?athlete_id=eq.${AID}&select=coach_user_id`), null, 2));

console.log("\n== physiological_profiles (FTP per kcal nutrition) ==");
console.log(JSON.stringify(await get(`physiological_profiles?athlete_id=eq.${AID}&select=ftp_watts,vo2max_ml_min_kg,updated_at`), null, 2));

console.log("\n== nutrition_plans 2026-05-31 (override esplicito?) ==");
console.log(JSON.stringify(await get(`nutrition_plans?athlete_id=eq.${AID}&date=eq.2026-05-31&select=date,kcal_target,carbs_g_target`), null, 2));

const prof = await get(`athlete_profiles?id=eq.${AID}&select=routine_config,nutrition_config`);
const row = Array.isArray(prof) ? prof[0] : null;
if (row?.routine_config) {
  let rc = row.routine_config;
  if (typeof rc === "string") {
    try { rc = JSON.parse(rc); } catch { rc = null; }
  }
  const sun = rc?.week_plan?.Sun ?? rc?.week_plan?.sun;
  console.log("\n== routine week_plan Sun (gara?) ==");
  console.log(JSON.stringify(sun, null, 2));
}

console.log("\n== executed_workouts 2026-05-28..06-02 (source) ==");
const ex = await get(`executed_workouts?athlete_id=eq.${AID}&date=gte.2026-05-28&date=lte.2026-06-02&select=id,date,duration_minutes,tss,source`);
console.log(JSON.stringify(ex, null, 2));

console.log("\n== planned per giorno 05-26..05-31 (conteggio per type) ==");
const pall = await get(`planned_workouts?athlete_id=eq.${AID}&date=gte.2026-05-26&date=lte.2026-05-31&select=date,type,duration_minutes,tss_target&order=date.asc`);
if (Array.isArray(pall)) {
  const byDay = {};
  for (const r of pall) { (byDay[r.date] ??= []).push(`${r.type}(${r.duration_minutes}m,tss${r.tss_target})`); }
  for (const [d, list] of Object.entries(byDay)) console.log(`${d}: ${list.length} righe -> ${list.join(" | ")}`);
}
