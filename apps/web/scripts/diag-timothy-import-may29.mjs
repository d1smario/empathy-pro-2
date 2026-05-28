/**
 * Diagnosi import Timothy 29-05-2026 — riproduce in console:
 *  - planned_workouts del giorno (eventuale doppione, durate, source)
 *  - executed_workouts del giorno (eventuale doppione, durate, source)
 *  - segments / steps grezzi nel notes JSON / chart se presenti
 *
 * Uso: node apps/web/scripts/diag-timothy-import-may29.mjs
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
    /** Alcuni file env sono salvati con escape "\\n" letterale: pulisce l'URL. */
    v = v.replace(/\\n$/g, "").replace(/\s+$/g, "");
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
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const aid = "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908";
const date = "2026-05-29";

async function dump(table, fields) {
  const url = `${base}/rest/v1/${table}?athlete_id=eq.${aid}&date=eq.${date}&select=${fields}`;
  const res = await fetch(url, { headers });
  const txt = await res.text();
  let rows;
  try {
    rows = JSON.parse(txt);
  } catch {
    rows = txt;
  }
  console.log(`\n=== ${table} (${date}) — ${Array.isArray(rows) ? rows.length : "ERR"} righe ===`);
  if (!Array.isArray(rows)) {
    console.log("status:", res.status, "body:", String(rows).slice(0, 600));
    return [];
  }
  for (const r of rows) {
    const summary = {
      id: r.id,
      type: r.type ?? r.workout_type,
      source: r.source ?? r.import_source,
      duration_minutes: r.duration_minutes,
      duration_seconds: r.duration_seconds,
      tss: r.tss,
      kj: r.kj_mechanical ?? r.kj,
      kcal: r.kcal_metabolic ?? r.kcal,
      created_at: r.created_at,
    };
    console.log(JSON.stringify(summary));
    const notes = r.notes;
    if (typeof notes === "string" && notes.includes("BUILDER_SESSION_JSON")) {
      const m = notes.match(/BUILDER_SESSION_JSON\s*([\s\S]*?)(?:$|\n\n)/);
      if (m) {
        try {
          const j = JSON.parse(m[1]);
          const blocks = j.blocks ?? j.chart ?? [];
          const blockSummary = blocks.slice(0, 12).map((b) => ({
            kind: b.kind ?? b.type,
            duration: b.duration ?? b.duration_seconds ?? b.duration_minutes ?? b.dur,
            target: b.target ?? b.target_w ?? b.power,
            zone: b.zone,
          }));
          console.log("  blocks[0..12]:", JSON.stringify(blockSummary, null, 2));
          const totalDur = blocks.reduce((a, b) => a + (Number(b.duration ?? b.duration_seconds ?? b.dur ?? 0) || 0), 0);
          console.log("  total dur sum (raw units):", totalDur);
        } catch (e) {
          console.log("  notes parse error:", e.message);
        }
      }
    }
    if (r.chart && Array.isArray(r.chart)) {
      console.log("  chart entries:", r.chart.length, "first:", JSON.stringify(r.chart[0]));
    }
    if (r.segments && Array.isArray(r.segments)) {
      console.log("  segments:", r.segments.length);
    }
  }
  return rows;
}

await dump("planned_workouts", "*");
await dump("executed_workouts", "*");
