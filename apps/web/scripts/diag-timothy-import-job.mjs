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

const ATHLETE = "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908";
const url = `${base}/rest/v1/training_import_jobs?athlete_id=eq.${ATHLETE}&select=*&order=created_at.desc&limit=10`;
const rows = await (await fetch(url, { headers })).json();
if (!Array.isArray(rows)) { console.error("err:", rows); process.exit(1); }
console.log(`training_import_jobs Timothy: ${rows.length} righe (10 piu' recenti)`);
for (const r of rows) {
  console.log(`  ${r.created_at?.slice(0, 16)} src=${r.source_format} kind=${r.detected_kind ?? "-"} status=${r.status} file=${r.file_name} bytes=${r.file_size_bytes} cks=${(r.file_checksum_sha1 ?? "").slice(0, 8)} id=${r.id?.slice(0, 8)}`);
}

const job = rows.find((r) => /\.fit$/i.test(String(r.file_name ?? "")) || String(r.source_format ?? "").includes("fit"));
if (!job) { console.log("\nNessun job FIT recente trovato."); process.exit(0); }
console.log("\nFIT job:", job.id, job.file_name);
console.log("payload top-level keys:", Object.keys(job.payload ?? {}));
const pl = job.payload ?? {};
if (pl.contract?.blocks) console.log("contract.blocks length:", pl.contract.blocks.length);
if (pl.intervalLadder) console.log("intervalLadder length:", pl.intervalLadder.length, "first:", JSON.stringify(pl.intervalLadder[0]));
if (pl.fitWorkoutSteps) {
  console.log("\nfitWorkoutSteps:", pl.fitWorkoutSteps.length);
  for (let i = 0; i < Math.min(pl.fitWorkoutSteps.length, 12); i++) {
    console.log(`  step[${i}]:`, JSON.stringify(pl.fitWorkoutSteps[i]).slice(0, 300));
  }
}
if (pl.rawFitBase64) console.log("\nrawFitBase64 length:", String(pl.rawFitBase64).length);
