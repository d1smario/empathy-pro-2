/** Cerca planned_workouts e executed_workouts con durata anomala (> 12h)
 *  in tutto il DB: residui del bug ms vs s su FIT TrainingPeaks. */
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
let env = null;
for (const p of [path.join(root, ".env.local.production"), path.join(root, ".env.local"), path.join(root, "apps", "web", ".env.local")]) {
  if (fs.existsSync(p)) { env = parseEnv(p); if (env.NEXT_PUBLIC_SUPABASE_URL) break; }
}
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

/** > 12h = 720 min: nessun workout reale dura cosi'. */
const u1 = `${base}/rest/v1/planned_workouts?duration_minutes=gte.720&select=id,athlete_id,date,type,duration_minutes,created_at&order=date.desc&limit=200`;
const u2 = `${base}/rest/v1/executed_workouts?duration_minutes=gte.720&select=id,athlete_id,date,duration_minutes,source,created_at&order=date.desc&limit=200`;

const r1 = await (await fetch(u1, { headers })).json();
const r2 = await (await fetch(u2, { headers })).json();
console.log(`PLANNED >= 720 min in DB: ${Array.isArray(r1) ? r1.length : "ERR"}`);
if (Array.isArray(r1)) for (const r of r1) console.log(`  ${r.date} dur=${r.duration_minutes}m type=${r.type} athlete=${r.athlete_id?.slice(0, 8)}.. id=${r.id.slice(0, 8)}.. created=${r.created_at?.slice(0, 16)}`);
console.log(`\nEXECUTED >= 720 min in DB: ${Array.isArray(r2) ? r2.length : "ERR"}`);
if (Array.isArray(r2)) for (const r of r2) console.log(`  ${r.date} dur=${r.duration_minutes}m source=${r.source} athlete=${r.athlete_id?.slice(0, 8)}.. id=${r.id.slice(0, 8)}.. created=${r.created_at?.slice(0, 16)}`);
