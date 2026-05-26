/**
 * Diagnostica planned_workouts per date — lista righe e athlete_id.
 * node scripts/diag-planned-dates.mjs [YYYY-MM-DD] [YYYY-MM-DD]
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
    v = v.replace(/\\n/g, "").trim();
    env[k] = v;
  }
  return env;
}

const envCandidates = [
  path.join(__dirname, "..", ".env.local"),
  path.join(__dirname, "..", "..", "..", ".env.local"),
  path.join(__dirname, "..", ".env.vercel.local"),
];

let env = null;
for (const p of envCandidates) {
  if (!fs.existsSync(p)) continue;
  env = parseEnv(p);
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) break;
}
if (!env?.NEXT_PUBLIC_SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const d1 = (process.argv[2] ?? "2026-05-27").slice(0, 10);
const d2 = (process.argv[3] ?? "2026-05-28").slice(0, 10);
const dates = d1 === d2 ? [d1] : [d1, d2].sort();

for (const date of dates) {
  const url = `${base}/rest/v1/planned_workouts?date=in.(${dates.map((d) => `"${d}"`).join(",")})&select=id,athlete_id,date,type,duration_minutes,tss_target,kcal_target,notes,created_at&order=date.asc,created_at.desc`;
  // per-date query for clarity
  const urlOne = `${base}/rest/v1/planned_workouts?date=eq.${encodeURIComponent(date)}&select=id,athlete_id,date,type,duration_minutes,tss_target,created_at,notes&order=created_at.desc`;
  const res = await fetch(urlOne, { headers });
  const rows = await res.json();
  console.log(`\n=== ${date} (status ${res.status}) ===`);
  if (!Array.isArray(rows)) {
    console.log(rows);
    continue;
  }
  console.log(`Count: ${rows.length}`);
  for (const r of rows) {
    const notesLen = typeof r.notes === "string" ? r.notes.length : 0;
    const hasBuilder = typeof r.notes === "string" && r.notes.includes("BUILDER_SESSION_JSON");
    console.log(
      `  id=${r.id} athlete=${r.athlete_id} type=${r.type} dur=${r.duration_minutes} tss=${r.tss_target} notes=${notesLen}ch builder=${hasBuilder} created=${r.created_at}`,
    );
  }
}

// Recent imports last 48h
const recentUrl = `${base}/rest/v1/planned_workouts?select=id,athlete_id,date,type,created_at&order=created_at.desc&limit=15`;
const recentRes = await fetch(recentUrl, { headers });
const recent = await recentRes.json();
console.log("\n=== Last 15 planned_workouts (any date) ===");
if (Array.isArray(recent)) {
  for (const r of recent) {
    console.log(`  ${r.date} id=${r.id} athlete=${r.athlete_id} type=${r.type} created=${r.created_at}`);
  }
}

console.log("\n=== ALL athletes: planned 27 + 28 ===");
const allUrl = `${base}/rest/v1/planned_workouts?date=in.("2026-05-27","2026-05-28")&select=id,athlete_id,date,type,duration_minutes,created_at&order=date.asc,created_at.desc`;
const allRes = await fetch(allUrl, { headers });
const allRows = await allRes.json();
if (Array.isArray(allRows)) {
  console.log(`Total rows: ${allRows.length}`);
  for (const r of allRows) {
    console.log(`  ${r.date} athlete=${r.athlete_id} ${r.type} ${r.duration_minutes}min created=${r.created_at}`);
  }
} else {
  console.log(allRows);
}

console.log("\n=== ALL athletes: executed 27 + 28 ===");
const exUrl = `${base}/rest/v1/executed_workouts?date=in.("2026-05-27","2026-05-28")&select=id,athlete_id,date,source,duration_minutes,created_at&order=date.asc`;
const exRes = await fetch(exUrl, { headers });
const exRows = await exRes.json();
if (Array.isArray(exRows)) {
  console.log(`Total executed: ${exRows.length}`);
  for (const r of exRows) {
    console.log(`  ${r.date} athlete=${r.athlete_id} ${r.source} ${r.duration_minutes}min created=${r.created_at}`);
  }
}

console.log("\n=== Planned created since 2026-05-26 (any date) ===");
const sinceUrl = `${base}/rest/v1/planned_workouts?created_at=gte.2026-05-26T00:00:00&select=id,athlete_id,date,type,created_at&order=created_at.desc&limit=25`;
const sinceRes = await fetch(sinceUrl, { headers });
const sinceRows = await sinceRes.json();
if (Array.isArray(sinceRows)) {
  console.log(`Count: ${sinceRows.length}`);
  for (const r of sinceRows) {
    console.log(`  ${r.date} athlete=${r.athlete_id} ${r.type} created=${r.created_at}`);
  }
}

// athlete_profiles count hint
const apUrl = `${base}/rest/v1/athlete_profiles?select=id,email&limit=20`;
const apRes = await fetch(apUrl, { headers });
const athletes = await apRes.json();
console.log("\n=== athlete_profiles (sample) ===");
if (Array.isArray(athletes)) {
  for (const a of athletes.slice(0, 10)) {
    console.log(`  ${a.id} ${a.email ?? ""}`);
  }
}

const ids = [
  "bfacf0d5-6563-477a-8733-0a5146f04279",
  "8933dda9-f7c9-4735-a933-4d19b2667e59",
  "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908",
  "e83e34de-5a03-46c1-a16a-45ed5cec35af",
  "917d9a00-d9a6-4211-bfe5-778f1cdfe3e5",
];
const apUrl2 = `${base}/rest/v1/athlete_profiles?id=in.(${ids.map((id) => `"${id}"`).join(",")})&select=id,email,first_name,last_name`;
const apRes2 = await fetch(apUrl2, { headers });
const apRows = await apRes2.json();
console.log("\n=== athlete_profiles (rilevanti) ===");
if (Array.isArray(apRows)) {
  for (const a of apRows) {
    console.log(`  ${a.id} ${a.email} ${a.first_name ?? ""} ${a.last_name ?? ""}`);
  }
}

const exDetailUrl = `${base}/rest/v1/executed_workouts?date=in.("2026-05-27","2026-05-28")&select=id,athlete_id,date,source,duration_minutes,tss,kcal,external_id,trace_summary,created_at`;
const exDetailRes = await fetch(exDetailUrl, { headers });
const exDetail = await exDetailRes.json();
console.log("\n=== executed 27-28 (dettaglio) ===");
if (Array.isArray(exDetail)) {
  for (const r of exDetail) {
    const ts = r.trace_summary && typeof r.trace_summary === "object" ? r.trace_summary : {};
    const fileName = ts.imported_file_name ?? ts.file_name ?? "—";
    console.log(
      `  ${r.date} ${r.athlete_id} src=${r.source} dur=${r.duration_minutes} tss=${r.tss} file=${fileName} created=${r.created_at}`,
    );
  }
}
