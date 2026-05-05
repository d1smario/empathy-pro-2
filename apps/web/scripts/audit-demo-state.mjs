import fs from "node:fs";

function parseEnv(p) {
  const raw = fs.readFileSync(p, "utf8");
  const env = {};
  for (const ln of raw.split(/\r?\n/)) {
    const i = ln.indexOf("=");
    if (i <= 0) continue;
    const k = ln.slice(0, i).trim();
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/\\n/g, "").trim();
    env[k] = v;
  }
  return env;
}

async function count(base, key, table, qs) {
  const url = `${base}/rest/v1/${table}?select=id&${qs}`;
  const r = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
  });
  return { status: r.status, countRange: r.headers.get("content-range") };
}

async function getAthleteIdsByEmail(base, key, email) {
  const url = `${base}/rest/v1/athlete_profiles?select=id,email&email=eq.${encodeURIComponent(email)}`;
  const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const j = await r.json();
  if (!Array.isArray(j)) return [];
  return j.map((row) => row.id).filter(Boolean);
}

async function main() {
  const env = parseEnv(".env.local.production");
  const base = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!base || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const emails = ["contact@d1s.ch", "m@d1s.ch"];
  for (const email of emails) {
    const athleteIds = await getAthleteIdsByEmail(base, key, email);
    console.log(`\nEMAIL ${email} -> athlete_ids:`, athleteIds);
    for (const athleteId of athleteIds) {
      const planned = await count(base, key, "planned_workouts", `athlete_id=eq.${athleteId}&notes=like.d1s-demo-janapr-v1-*`);
      const executed = await count(base, key, "executed_workouts", `athlete_id=eq.${athleteId}&external_id=like.d1s-demo-janapr-v1-*`);
      const device = await count(base, key, "device_sync_exports", `athlete_id=eq.${athleteId}&external_ref=like.d1s-demo-janapr-v1-*`);
      const biomarker = await count(base, key, "biomarker_panels", `athlete_id=eq.${athleteId}&source=eq.d1s-demo-janapr-v1-seed`);
      console.log({ athleteId, planned: planned.countRange, executed: executed.countRange, device: device.countRange, biomarker: biomarker.countRange });
    }
  }

  const fdc = await count(base, key, "nutrition_fdc_foods", "fdc_id=gte.1");
  console.log("\nFDC cache count:", fdc.countRange);
}

await main();
