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

async function rest(base, key, path) {
  const r = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data: j };
}

function get(obj, path, fallback = null) {
  let cur = obj;
  for (const k of path) {
    if (!cur || typeof cur !== "object" || !(k in cur)) return fallback;
    cur = cur[k];
  }
  return cur ?? fallback;
}

async function main() {
  const env = parseEnv(".env.local.production");
  const base = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const email = "m@d1s.ch";
  if (!base || !key) throw new Error("Missing Supabase config");

  const athleteRes = await rest(base, key, `athlete_profiles?select=id,email,first_name,last_name&email=eq.${encodeURIComponent(email)}`);
  const athlete = Array.isArray(athleteRes.data) ? athleteRes.data[0] : null;
  if (!athlete?.id) throw new Error(`No athlete found for ${email}`);
  const athleteId = athlete.id;
  console.log("ATHLETE", athlete);

  const profileByAthleteRes = await rest(
    base,
    key,
    `app_user_profiles?select=user_id,role,athlete_id,platform_coach_status&athlete_id=eq.${athleteId}`,
  );
  const profileByAthlete = Array.isArray(profileByAthleteRes.data) ? profileByAthleteRes.data : [];
  console.log("APP_USER_PROFILE_BY_ATHLETE", profileByAthlete);

  const healthRes = await rest(
    base,
    key,
    `biomarker_panels?select=type,sample_date,created_at,source&athlete_id=eq.${athleteId}&order=sample_date.desc&limit=50`,
  );
  const healthRows = Array.isArray(healthRes.data) ? healthRes.data : [];
  const byType = {};
  for (const r of healthRows) byType[r.type || "unknown"] = (byType[r.type || "unknown"] || 0) + 1;
  console.log("HEALTH_ROWS", healthRows.length, "BY_TYPE", byType);

  const execRes = await rest(
    base,
    key,
    `executed_workouts?select=date,trace_summary,lactate_mmoll,glucose_mmol,smo2&athlete_id=eq.${athleteId}&order=date.desc&limit=120`,
  );
  const execRows = Array.isArray(execRes.data) ? execRes.data : [];
  let sleepN = 0;
  let hrvN = 0;
  let hrN = 0;
  for (const row of execRows) {
    const t = row.trace_summary && typeof row.trace_summary === "object" ? row.trace_summary : {};
    const sleep = get(t, ["sleep_hours"]) ?? get(t, ["total_sleep_hours"]) ?? get(t, ["sleep_duration_hours"]);
    const hrv = get(t, ["hrv_rmssd_ms"]) ?? get(t, ["rmssd"]);
    const hr = get(t, ["resting_hr_bpm"]) ?? get(t, ["night_hr_bpm"]);
    if (sleep != null) sleepN += 1;
    if (hrv != null) hrvN += 1;
    if (hr != null) hrN += 1;
  }
  console.log("EXECUTED_ROWS", execRows.length, "sleep", sleepN, "hrv", hrvN, "hr", hrN);

  const deviceRes = await rest(
    base,
    key,
    `device_sync_exports?select=provider,payload,created_at,external_ref&athlete_id=eq.${athleteId}&order=created_at.desc&limit=250`,
  );
  const deviceRows = Array.isArray(deviceRes.data) ? deviceRes.data : [];
  let whoopN = 0;
  let cgmN = 0;
  let whoopSleepN = 0;
  for (const row of deviceRows) {
    if (row.provider === "whoop") {
      whoopN += 1;
      const p = row.payload && typeof row.payload === "object" ? row.payload : {};
      const s = get(p, ["sourcePayload", "sleep_hours"]) ?? get(p, ["sourcePayload", "total_sleep_minutes"]);
      if (s != null) whoopSleepN += 1;
    }
    if (row.provider === "cgm") cgmN += 1;
  }
  console.log("DEVICE_ROWS", deviceRows.length, "whoop", whoopN, "whoopSleep", whoopSleepN, "cgm", cgmN);

  const fdcRes = await rest(base, key, "nutrition_fdc_foods?select=fdc_id,description,vitamins,minerals&order=refreshed_at.desc&limit=20");
  const fdcRows = Array.isArray(fdcRes.data) ? fdcRes.data : [];
  const withMicros = fdcRows.filter((r) => Array.isArray(r.vitamins) && r.vitamins.length && Array.isArray(r.minerals) && r.minerals.length);
  console.log("FDC_TOP20", fdcRows.length, "with_micros", withMicros.length);
}

await main();
