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

function parseJson(v) {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v && typeof v === "object" ? v : null;
}

const athleteId = process.argv[2] ?? "bfacf0d5-6563-477a-8733-0a5146f04279";
const sourceDay = process.argv[3] ?? "Mon";
const targetDay = process.argv[4] ?? "Tue";

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

const getRes = await fetch(
  `${base}/rest/v1/athlete_profiles?select=id,email,nutrition_config,routine_config,preferred_meal_count&id=eq.${athleteId}`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);
const athlete = (await getRes.json())[0];
if (!athlete) throw new Error("Athlete not found");

const nc = parseJson(athlete.nutrition_config) ?? {};
const rc = parseJson(athlete.routine_config) ?? {};
nc.week_plan = nc.week_plan ?? {};
rc.week_plan = rc.week_plan ?? {};

const sourceDiet = nc.week_plan[sourceDay];
if (!sourceDiet) throw new Error(`No diet for source day ${sourceDay}`);

nc.week_plan[targetDay] = JSON.parse(JSON.stringify(sourceDiet));

if (rc.week_plan[sourceDay] && rc.week_plan[targetDay]) {
  const src = rc.week_plan[sourceDay];
  const tgt = rc.week_plan[targetDay];
  for (const k of [
    "breakfast_time",
    "lunch_time",
    "dinner_time",
    "snack_time",
    "afternoon_snack_time",
    "night_time",
  ]) {
    if (src[k] != null && src[k] !== "") tgt[k] = src[k];
  }
}

const patch = {
  nutrition_config: nc,
  routine_config: rc,
  preferred_meal_count: 6,
};

const patchRes = await fetch(`${base}/rest/v1/athlete_profiles?id=eq.${athleteId}`, {
  method: "PATCH",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify(patch),
});
const patched = await patchRes.json();
if (!patchRes.ok) {
  console.error("PATCH_FAILED", patchRes.status, patched);
  process.exit(1);
}

console.log("OK", athlete.email);
console.log(`Copied Diet ${sourceDay} -> ${targetDay}`, JSON.stringify(nc.week_plan[targetDay], null, 2));
console.log("preferred_meal_count -> 6");
