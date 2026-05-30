/**
 * Rimuove il doppione `planned_workouts` del 2026-05-31 per Nicola Giustacchini:
 * tiene la riga builder aerobic più recente (kcal + contratto), elimina la vecchia mitochondrial_density.
 *
 * Uso: node scripts/delete-giustacchini-planned-31-05.mjs [--apply]
 */
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
const envPaths = [
  path.join(root, "apps", "web", ".env.local"),
  path.join(root, ".env.local"),
  path.join(root, ".env.local.production"),
];
let env = null;
for (const p of envPaths) {
  if (!fs.existsSync(p)) continue;
  env = parseEnv(p);
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) break;
}
if (!env) throw new Error("Missing env");

const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\\[rn]/g, "").trim().replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY.replace(/\\[rn]/g, "").trim();
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const ATHLETE = "bfacf0d5-6563-477a-8733-0a5146f04279";
const DATE = "2026-05-31";
/** Riga vecchia (stesso TSS/durata, kcal_target null, save precedente). */
const DELETE_ID = "c89572df-f7a0-4db8-ba53-7a5bf9b736e0";

const rows = await fetch(
  `${base}/rest/v1/planned_workouts?athlete_id=eq.${ATHLETE}&date=eq.${DATE}&select=id,type,duration_minutes,tss_target,kcal_target,created_at`,
  { headers },
).then((r) => r.json());

console.log(`Prima (${rows.length} righe):`);
for (const r of rows) {
  console.log(`  ${r.id} ${r.type} ${r.duration_minutes}m tss=${r.tss_target} kcal=${r.kcal_target} @ ${r.created_at}`);
}

const target = rows.find((r) => r.id === DELETE_ID);
if (!target) {
  console.log(`\nId ${DELETE_ID} non trovato — già pulito o id cambiato.`);
  process.exit(0);
}

if (!process.argv.includes("--apply")) {
  console.log(`\n[DRY-RUN] Eliminerei ${DELETE_ID} (${target.type}). Rilancia con --apply`);
  process.exit(0);
}

const del = await fetch(`${base}/rest/v1/planned_workouts?id=eq.${DELETE_ID}`, {
  method: "DELETE",
  headers: { ...headers, Prefer: "return=minimal" },
});
if (!del.ok) {
  console.error("DELETE failed:", del.status, await del.text());
  process.exit(1);
}

const after = await fetch(
  `${base}/rest/v1/planned_workouts?athlete_id=eq.${ATHLETE}&date=eq.${DATE}&select=id,type,duration_minutes,tss_target,kcal_target`,
  { headers },
).then((r) => r.json());
console.log(`\nDopo (${after.length} righe):`);
for (const r of after) {
  console.log(`  ${r.id} ${r.type} ${r.duration_minutes}m tss=${r.tss_target} kcal=${r.kcal_target}`);
}
