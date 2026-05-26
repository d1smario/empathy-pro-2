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
    v = v.replace(/\\n/g, "").trim();
    env[ln.slice(0, i).trim()] = v;
  }
  return env;
}
const env = parseEnv(path.join(root, ".env.local"));
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: `Bearer ${key}` };

async function q(table, qs) {
  const r = await fetch(`${base}/rest/v1/${table}?${qs}`, { headers: h });
  return { status: r.status, data: await r.json() };
}

const athletes = [
  ["bfacf0d5-6563-477a-8733-0a5146f04279", "bfacf0d5 (builder dupes earlier)"],
  ["8933dda9-f7c9-4735-a933-4d19b2667e59", "m@d1s.ch"],
  ["e83e34de-5a03-46c1-a16a-45ed5cec35af", "contact@d1s.ch"],
];

for (const [aid, label] of athletes) {
  console.log(`\n--- ${label} ---`);
  for (const d of ["2026-05-27", "2026-05-28"]) {
    const p = await q(
      "planned_workouts",
      `athlete_id=eq.${aid}&date=eq.${d}&select=id,date,type,duration_minutes,tss_target,created_at,notes`,
    );
    const e = await q(
      "executed_workouts",
      `athlete_id=eq.${aid}&date=eq.${d}&select=id,date,source,duration_minutes,tss,external_id,created_at`,
    );
    const planned = Array.isArray(p.data) ? p.data : [];
    const executed = Array.isArray(e.data) ? e.data : [];
    console.log(`  ${d}: planned=${planned.length} executed=${executed.length}`);
    for (const r of planned) {
      const n = typeof r.notes === "string" ? r.notes.length : 0;
      console.log(`    P ${r.id} ${r.type} ${r.duration_minutes}min tss=${r.tss_target} notes=${n}ch ${r.created_at}`);
    }
    for (const r of executed) {
      console.log(`    E ${r.id} ${r.source} ${r.duration_minutes}min ext=${r.external_id ?? "—"} ${r.created_at}`);
    }
  }
}

const recent = await q(
  "planned_workouts",
  "created_at=gte.2026-05-26T00:00:00&date=gte.2026-05-27&date=lte.2026-05-28&select=id,athlete_id,date,type,created_at&order=created_at.desc",
);
console.log("\n=== Planned 27-28 created since May 26 ===");
if (Array.isArray(recent.data)) {
  for (const r of recent.data) {
    console.log(`  ${r.date} athlete=${r.athlete_id} ${r.type} created=${r.created_at}`);
  }
  if (recent.data.length === 0) console.log("  (none)");
}
