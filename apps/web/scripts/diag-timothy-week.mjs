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
    v = v.replace(/\\n$/g, "").replace(/\s+$/g, "");
    env[ln.slice(0, i).trim()] = v;
  }
  return env;
}

const candidates = [
  path.join(root, ".env.local.production"),
  path.join(root, ".env.local"),
  path.join(root, "apps", "web", ".env.local"),
];
let env = null;
for (const p of candidates) if (fs.existsSync(p)) { env = parseEnv(p); if (env.NEXT_PUBLIC_SUPABASE_URL) break; }
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const ATHLETE = "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908";
const FROM = "2026-05-25";
const TO = "2026-06-05";

const u1 = `${base}/rest/v1/planned_workouts?athlete_id=eq.${ATHLETE}&date=gte.${FROM}&date=lte.${TO}&select=*&order=date.asc,created_at.asc`;
const u2 = `${base}/rest/v1/executed_workouts?athlete_id=eq.${ATHLETE}&date=gte.${FROM}&date=lte.${TO}&select=id,date,duration_minutes,source,created_at&order=date.asc,created_at.asc`;

const r1 = await (await fetch(u1, { headers })).json();
const r2 = await (await fetch(u2, { headers })).json();

if (!Array.isArray(r1)) { console.error("planned err:", r1); process.exit(1); }
console.log(`PLANNED Timothy ${FROM}..${TO}: ${r1.length} righe`);
for (const r of r1) {
  const upd = r.updated_at ? ` upd=${r.updated_at.slice(0, 16)}` : "";
  console.log(`  ${r.date} dur=${r.duration_minutes}m type=${r.type ?? "-"} id=${r.id.slice(0, 8)}.. created=${r.created_at?.slice(0, 16)}${upd}`);
}
console.log(`\nEXECUTED Timothy ${FROM}..${TO}: ${r2.length} righe`);
for (const r of r2) {
  console.log(`  ${r.date} dur=${r.duration_minutes}m source=${r.source} id=${r.id.slice(0, 8)}.. created=${r.created_at?.slice(0, 16)}`);
}
