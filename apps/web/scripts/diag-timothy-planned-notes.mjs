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

const ID = "d4900153-636c-4c68-943f-96ee8667d052";
const url = `${base}/rest/v1/planned_workouts?id=eq.${ID}&select=id,date,duration_minutes,notes,created_at`;
const res = await fetch(url, { headers });
const rows = await res.json();
if (!Array.isArray(rows) || rows.length === 0) { console.error("not found", rows); process.exit(1); }
const r = rows[0];
console.log("ID:", r.id, "date:", r.date, "dur_min:", r.duration_minutes, "created:", r.created_at);

const notes = r.notes ?? "";
const m = notes.match(/BUILDER_SESSION_JSON::(.+?)(?:\n|$)/s);
if (!m) {
  console.log("notes head:", notes.slice(0, 400));
  process.exit(0);
}
const decoded = decodeURIComponent(m[1]);
const json = JSON.parse(decoded);
console.log("\ncontract.summary:", JSON.stringify(json.summary, null, 2));
console.log("\nplannedSessionDurationMinutes:", json.plannedSessionDurationMinutes);

const blocks = Array.isArray(json.blocks) ? json.blocks : Array.isArray(json.chart) ? json.chart : [];
console.log(`\nblocks: ${blocks.length}`);
for (let i = 0; i < blocks.length; i++) {
  const b = blocks[i];
  const dm = b.durationMinutes ?? b.chart?.minutes ?? 0;
  const ds = b.chart?.seconds ?? 0;
  console.log(`  [${i + 1}] dur=${dm}m${ds}s  intensityCue=${b.intensityCue ?? "-"}  target=${b.target ?? "-"}`);
}

const ladder = json.intervalLadder ?? json.interval_ladder ?? null;
if (Array.isArray(ladder)) {
  console.log(`\nintervalLadder: ${ladder.length} righe`);
  for (let i = 0; i < ladder.length; i++) {
    const r = ladder[i];
    console.log(`  [${i + 1}] dur=${r.durationSec}s pAvg=${r.powerAvgW} pLow=${r.powerLowW} pHigh=${r.powerHighW} type=${r.durationType} kind=${r.kind} label=${r.label ?? "-"}`);
  }
}
