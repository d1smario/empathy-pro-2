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

const uid = process.argv[2];
const months = Number(process.argv[3] ?? 12);
const kind = process.argv[4] ?? "beta";
if (!uid) {
  console.error("Usage: node scripts/grant-user-access.mjs <user_id> [months] [kind]");
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
  throw new Error("Missing Supabase config");
}

const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const startsAt = new Date();
const endsAt = new Date(startsAt);
endsAt.setUTCMonth(endsAt.getUTCMonth() + months);

const body = {
  user_id: uid,
  kind,
  starts_at: startsAt.toISOString(),
  ends_at: endsAt.toISOString(),
  note: `Manual grant via grant-user-access.mjs (${months}m)`,
  granted_by_email: "ops:grant-user-access-script",
};

const r = await fetch(`${base}/rest/v1/subscription_grants`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify(body),
});
const j = await r.json().catch(() => null);
if (!r.ok) {
  console.error("GRANT_FAILED", r.status, j);
  process.exit(1);
}
console.log("GRANT_OK", JSON.stringify(j, null, 2));
