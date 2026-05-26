import fs from "node:fs";

function parseEnv(p) {
  const raw = fs.readFileSync(p, "utf8");
  const env = {};
  for (const ln of raw.split(/\r?\n/)) {
    const i = ln.indexOf("=");
    if (i <= 0) continue;
    const k = ln.slice(0, i).trim();
    let v = ln.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/\\n/g, "").trim();
    env[k] = v;
  }
  return env;
}

const athleteId = process.argv[2] ?? "bfacf0d5-6563-477a-8733-0a5146f04279";

const envPaths = ["../../.env.local.production", ".env.local.production", ".env.local"];
let env = null;
for (const p of envPaths) {
  try {
    env = parseEnv(p);
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) break;
  } catch {
    /* */
  }
}
if (!env?.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Missing env");

const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;

const r = await fetch(
  `${base}/rest/v1/athlete_profiles?select=id,email,preferred_meal_count,nutrition_config,routine_config&id=eq.${athleteId}`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
const rows = await r.json();
const athlete = Array.isArray(rows) ? rows[0] : null;
if (!athlete) throw new Error("Athlete not found");

function parseJson(v) {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v;
}

const nc = parseJson(athlete.nutrition_config) ?? {};
const rc = parseJson(athlete.routine_config) ?? {};
const wp = nc.week_plan ?? {};

console.log("ATHLETE", athlete.email, "preferred_meal_count", athlete.preferred_meal_count);
console.log("WEEK_PLAN_KEYS", Object.keys(wp));

for (const k of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
  const d = wp[k];
  if (!d) {
    console.log(`\n${k}: MISSING`);
    continue;
  }
  console.log(`\n${k}:`, JSON.stringify({
    meal_count_mode: d.meal_count_mode,
    caloric_distribution: d.caloric_distribution,
    daily_macros: d.daily_macros,
    day_type: d.day_type,
    day_type_pct: d.day_type_pct,
  }, null, 2));
}

console.log("\nLEGACY_ROOT", JSON.stringify({
  meal_strategy: nc.meal_strategy,
  caloric_split: nc.caloric_split,
  meal_plan: nc.meal_plan,
}, null, 2));

console.log("\nROUTINE week_plan Tue meal_times:", JSON.stringify(rc?.week_plan?.Tue?.meal_times ?? rc?.meal_times ?? null, null, 2));
