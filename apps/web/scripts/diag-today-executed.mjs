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
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/\\n/g, "").trim();
    env[ln.slice(0, i).trim()] = v;
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

const day = (process.argv[2] ?? "2026-05-26").slice(0, 10);

const exUrl = `${base}/rest/v1/executed_workouts?date=eq.${day}&select=id,athlete_id,date,source,duration_minutes,tss&order=duration_minutes.desc`;
const exRes = await fetch(exUrl, { headers });
const exRows = await exRes.json();
console.log(`=== executed ${day} (all athletes) status=${exRes.status} ===`);
if (!Array.isArray(exRows)) {
  console.log(exRows);
  process.exit(0);
}
console.log(`count=${exRows.length}`);
for (const r of exRows) {
  console.log(`  athlete=${r.athlete_id} dur=${r.duration_minutes} tss=${r.tss} src=${r.source}`);
}

const ids = [...new Set(exRows.map((r) => r.athlete_id))];
if (ids.length) {
  const apUrl = `${base}/rest/v1/athlete_profiles?id=in.(${ids.map((id) => `"${id}"`).join(",")})&select=id,email,first_name,last_name`;
  const apRes = await fetch(apUrl, { headers });
  const apRows = await apRes.json();
  console.log("\n=== profiles ===");
  if (Array.isArray(apRows)) {
    for (const a of apRows) {
      console.log(`  ${a.id} | ${a.first_name ?? ""} ${a.last_name ?? ""} | ${a.email ?? ""}`);
    }
  }
}

const plUrl = `${base}/rest/v1/planned_workouts?date=eq.${day}&select=id,athlete_id,type,duration_minutes,tss_target&order=created_at.desc`;
const plRes = await fetch(plUrl, { headers });
const plRows = await plRes.json();
console.log(`\n=== planned ${day} ===`);
if (Array.isArray(plRows)) {
  for (const r of plRows) {
    console.log(`  athlete=${r.athlete_id} ${r.type} dur=${r.duration_minutes} tss=${r.tss_target}`);
  }
}

const timothyId = "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908";
const prefRes = await fetch(
  `${base}/rest/v1/athlete_data_source_preference?athlete_id=eq.${timothyId}&select=domain,primary_provider`,
  { headers },
);
console.log("\n=== Timothy prefs ===", await prefRes.json());

const exTim = await fetch(
  `${base}/rest/v1/executed_workouts?athlete_id=eq.${timothyId}&date=eq.${day}&select=id,duration_minutes,source,trace_summary`,
  { headers },
);
const exTimRows = await exTim.json();
if (Array.isArray(exTimRows) && exTimRows[0]) {
  const ts = exTimRows[0].trace_summary ?? {};
  console.log("Timothy exec trace distance:", ts.distance_km ?? ts.distanceKm ?? ts.km, "dur", exTimRows[0].duration_minutes);
}

for (const d of ["2026-05-27", "2026-05-28"]) {
  const u = `${base}/rest/v1/planned_workouts?athlete_id=eq.${timothyId}&date=eq.${d}&select=id,type,duration_minutes`;
  const p = await (await fetch(u, { headers })).json();
  const u2 = `${base}/rest/v1/executed_workouts?athlete_id=eq.${timothyId}&date=eq.${d}&select=id,source,duration_minutes`;
  const e = await (await fetch(u2, { headers })).json();
  console.log(`\nTimothy ${d}: planned=${Array.isArray(p) ? p.length : "?"} executed=${Array.isArray(e) ? e.length : "?"}`);
  if (Array.isArray(e)) for (const row of e) console.log(`  exec ${row.source} ${row.duration_minutes}m`);
}
