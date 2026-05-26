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

async function rest(base, key, path) {
  const r = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data: j };
}

const uid = process.argv[2];
if (!uid) {
  console.error("Usage: node scripts/diag-user-access.mjs <user_id>");
  process.exit(1);
}

const envPaths = ["../../.env.local.production", ".env.local.production", ".env.local"];
let env = null;
for (const p of envPaths) {
  try {
    env = parseEnv(p);
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) break;
  } catch {
    /* try next */
  }
}
if (!env?.NEXT_PUBLIC_SUPABASE_URL || !env?.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase config (tried .env.local.production at repo root and apps/web)");
}
const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;

const authRes = await fetch(`${base}/auth/v1/admin/users/${uid}`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const authUser = await authRes.json().catch(() => null);
console.log(
  "AUTH_USER",
  JSON.stringify(
    {
      ok: authRes.ok,
      status: authRes.status,
      email: authUser?.email,
      confirmed: authUser?.email_confirmed_at,
      last_sign_in: authUser?.last_sign_in_at,
      banned: authUser?.banned_until,
    },
    null,
    2,
  ),
);

const profRes = await rest(base, key, `app_user_profiles?select=*&user_id=eq.${uid}`);
console.log("APP_USER_PROFILE", JSON.stringify(profRes.data, null, 2));

const subsRes = await rest(base, key, `billing_subscriptions?select=*&user_id=eq.${uid}`);
console.log("BILLING_SUBS", JSON.stringify(subsRes.data, null, 2));

const grantsRes = await rest(base, key, `subscription_grants?select=*&user_id=eq.${uid}`);
console.log("GRANTS", JSON.stringify(grantsRes.data, null, 2));

const athleteId = Array.isArray(profRes.data) ? profRes.data[0]?.athlete_id : null;
if (athleteId) {
  const athRes = await rest(
    base,
    key,
    `athlete_profiles?select=id,email,first_name,last_name,created_at&id=eq.${athleteId}`,
  );
  console.log("ATHLETE_PROFILE", JSON.stringify(athRes.data, null, 2));
} else {
  console.log("ATHLETE_PROFILE", "missing athlete_id on profile");
  const email = authUser?.email;
  if (email) {
    const byEmail = await rest(
      base,
      key,
      `athlete_profiles?select=id,email,first_name,last_name,created_at&email=eq.${encodeURIComponent(email)}`,
    );
    console.log("ATHLETE_BY_EMAIL", JSON.stringify(byEmail.data, null, 2));
  }
}
