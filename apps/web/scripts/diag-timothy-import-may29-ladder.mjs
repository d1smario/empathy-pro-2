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

const env = parseEnv(path.join(root, ".env.local.production"));
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const aid = "c2bd27ec-3261-45fb-a9ff-a6dc7e9bc908";
const date = "2026-05-29";

const url = `${base}/rest/v1/executed_workouts?athlete_id=eq.${aid}&date=eq.${date}&select=id,duration_minutes,trace_summary,source`;
const res = await fetch(url, { headers });
const rows = await res.json();
if (!Array.isArray(rows) || !rows[0]) {
  console.log("no data", rows);
  process.exit(1);
}
const r = rows[0];
const ts = r.trace_summary ?? {};
console.log("duration_minutes:", r.duration_minutes);
console.log("source:", r.source);
console.log("trace.parser_engine:", ts.parser_engine);
console.log("trace.power_avg_w:", ts.power_avg_w);
console.log("trace.trackpoint_count:", ts.trackpoint_count);
console.log("trace.fit_record_messages:", ts.fit_record_messages);
const ladder = ts.structured_interval_ladder ?? [];
console.log(`ladder rows: ${ladder.length}`);
console.log("\nFirst 12 ladder rows:");
for (const row of ladder.slice(0, 12)) {
  console.log(JSON.stringify({
    idx: row.index,
    durSec: row.durationSec,
    durMmss: `${Math.floor(row.durationSec / 3600)}h ${Math.floor((row.durationSec % 3600) / 60)}m ${row.durationSec % 60}s`,
    pAvg: row.powerAvgW,
    pLow: row.powerLowW,
    pHigh: row.powerHighW,
    type: row.durationType,
    kind: row.kind,
    label: row.label,
  }));
}
const totalSec = ladder.reduce((a, b) => a + Number(b.durationSec || 0), 0);
console.log(`\nLadder totalSec: ${totalSec} = ${Math.round(totalSec / 60)} min = ${(totalSec / 3600).toFixed(2)} h`);

/** Per planned: estrai BUILDER_SESSION_JSON dalle notes (URL-encoded). */
const purl = `${base}/rest/v1/planned_workouts?athlete_id=eq.${aid}&date=eq.${date}&select=id,type,duration_minutes,notes`;
const pres = await fetch(purl, { headers });
const prows = await pres.json();
if (Array.isArray(prows) && prows[0]) {
  const p = prows[0];
  console.log("\n--- PLANNED ---");
  console.log("type:", p.type, "duration_minutes:", p.duration_minutes);
  const notes = String(p.notes ?? "");
  const m = notes.match(/BUILDER_SESSION_JSON\s*([^\s][\s\S]*?)(?:\n\n|$)/);
  if (m) {
    let raw = m[1].trim();
    /** notes ha URL-encoding: prova a decodificarlo */
    try {
      raw = decodeURIComponent(raw);
    } catch {}
    try {
      const j = JSON.parse(raw);
      console.log("contract.summary:", j.summary);
      console.log("contract.blocks count:", (j.blocks ?? []).length);
      const blockSummary = (j.blocks ?? []).slice(0, 12).map((b) => ({
        kind: b.kind,
        durMin: b.durationMinutes,
        chartMin: b.chart?.minutes,
        chartSec: b.chart?.seconds,
        intensity: b.intensityCue || b.chart?.intensity,
        label: b.label,
      }));
      console.log("blocks[0..12]:", JSON.stringify(blockSummary, null, 2));
    } catch (e) {
      console.log("notes JSON parse error:", e.message);
      console.log("notes head (300):", raw.slice(0, 300));
    }
  } else {
    console.log("no BUILDER_SESSION_JSON in notes");
    console.log("notes head:", notes.slice(0, 200));
  }
}
