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
  path.join(root, ".env.local.production"),
  path.join(root, ".env.local"),
  path.join(root, "apps", "web", ".env.local"),
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
const headers = { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" };

const aid = "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908";
const from = "2026-03-17";
const to = "2026-07-15";

const url = `${base}/rest/v1/executed_workouts?athlete_id=eq.${aid}&date=gte.${from}&date=lte.${to}&select=id,date,duration_minutes,source&order=date.asc`;
const res = await fetch(url, { headers });
const rows = await res.json();
console.log("content-range:", res.headers.get("content-range"));
console.log("rows:", Array.isArray(rows) ? rows.length : rows);
if (Array.isArray(rows)) {
  const may26 = rows.filter((r) => String(r.date).startsWith("2026-05-26"));
  console.log("may26:", may26);
  console.log("last5:", rows.slice(-5).map((r) => `${r.date} ${r.duration_minutes}m`));
}

// trace payload size for one row
const bigUrl = `${base}/rest/v1/executed_workouts?athlete_id=eq.${aid}&date=eq.2026-05-26&select=id,date,duration_minutes,trace_summary`;
const bigRes = await fetch(bigUrl, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
const bigRows = await bigRes.json();
if (Array.isArray(bigRows) && bigRows[0]) {
  const ts = JSON.stringify(bigRows[0].trace_summary ?? null);
  console.log("may26 trace_summary bytes:", ts.length);
}
