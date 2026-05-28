/**
 * Cleanup retroattivo: rimuove le righe `executed_workouts` create come
 * "structured_plan_companion" (synthetic). Sono companion sintetici di un
 * import strutturato (ZWO/ERG/MRC/FIT workout) che NON erano attivita' reali.
 *
 * Regola operativa: un import di programma non e' un eseguito. La pipeline
 * canonica li lascia ora solo come `planned_workouts`; questo script bonifica
 * i record gia' creati prima del fix (es. Timothy 29-05-2026, durata 195h47m).
 *
 * Uso:
 *   node apps/web/scripts/cleanup-structured-companion-executed.mjs            # dry-run
 *   node apps/web/scripts/cleanup-structured-companion-executed.mjs --apply    # esegue
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const APPLY = process.argv.includes("--apply");

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
for (const p of candidates) {
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
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

const url = `${base}/rest/v1/executed_workouts?source=like.structured_plan_companion%3A*&select=id,athlete_id,date,duration_minutes,source,created_at&order=created_at.desc&limit=2000`;
const res = await fetch(url, { headers });
const rows = await res.json();
if (!Array.isArray(rows)) {
  console.error("err:", rows);
  process.exit(1);
}

console.log(`Trovati ${rows.length} executed_workouts companion (sintetici).\n`);
for (const r of rows.slice(0, 30)) {
  console.log(
    `${r.date} athlete=${r.athlete_id.slice(0, 8)}.. dur=${r.duration_minutes}m source=${r.source} created=${r.created_at?.slice(0, 16)}`,
  );
}
if (rows.length > 30) console.log(`... e altri ${rows.length - 30}`);

if (!APPLY) {
  console.log(`\n[DRY-RUN] Non sto cancellando nulla. Lancia con --apply per eseguire.`);
  process.exit(0);
}

console.log(`\nDELETE in corso (--apply attivo)...`);
const ids = rows.map((r) => r.id);
const chunks = [];
for (let i = 0; i < ids.length; i += 80) chunks.push(ids.slice(i, i + 80));

let deleted = 0;
for (const ch of chunks) {
  const list = ch.map((x) => `"${x}"`).join(",");
  const delUrl = `${base}/rest/v1/executed_workouts?id=in.(${list})`;
  const dr = await fetch(delUrl, { method: "DELETE", headers });
  if (!dr.ok) {
    console.error(`Errore DELETE chunk: ${dr.status} ${await dr.text()}`);
    continue;
  }
  deleted += ch.length;
  console.log(`  cancellati ${deleted}/${ids.length}`);
}
console.log(`Cleanup completo. ${deleted} righe rimosse.`);
