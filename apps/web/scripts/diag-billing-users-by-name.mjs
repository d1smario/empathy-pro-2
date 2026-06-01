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
    env[ln.slice(0, i).trim()] = v;
  }
  return env;
}

const envCandidates = [
  path.join(root, "apps", "web", ".env.local"),
  path.join(root, ".env.local"),
  path.join(root, ".env.local.production"),
];
let env = null;
for (const p of envCandidates) {
  if (!fs.existsSync(p)) continue;
  const e = parseEnv(p);
  if (e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_SERVICE_ROLE_KEY) {
    env = e;
    break;
  }
}
if (!env) throw new Error("Missing Supabase env");

const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function get(pathq) {
  const res = await fetch(`${base}/rest/v1/${pathq}`, { headers });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error("REST error", res.status, text.slice(0, 300));
    return null;
  }
}

const needles = process.argv.slice(2).length ? process.argv.slice(2) : ["malera", "ambrosini"];

// Sanity check REST
const probe = await get("billing_customers?select=email,user_id,stripe_customer_id&limit=1");
console.log("PROBE billing_customers", JSON.stringify(probe, null, 2));

for (const n of needles) {
  const like = encodeURIComponent(`%${n}%`);
  const custByEmail = await get(
    `billing_customers?email=ilike.${like}&select=user_id,stripe_customer_id,email,updated_at`,
  );
  console.log(`\n========== billing_customers email ~ ${n} ==========`);
  console.log(JSON.stringify(custByEmail, null, 2));

  const ath = await get(
    `athlete_profiles?or=(last_name.ilike.${like},first_name.ilike.${like},email.ilike.${like})&select=id,email,first_name,last_name,created_at`,
  );
  console.log(`\n========== ATHLETE search: ${n} ==========`);
  console.log(JSON.stringify(ath, null, 2));
  if (!Array.isArray(ath)) continue;
  for (const a of ath) {
    const prof = await get(`app_user_profiles?athlete_id=eq.${a.id}&select=*`);
    console.log(`\n--- app_user_profiles (${a.email}) ---`);
    console.log(JSON.stringify(prof, null, 2));
    const uid = Array.isArray(prof) ? prof[0]?.user_id : null;
    if (!uid) {
      const profByEmail = await get(`app_user_profiles?select=*&limit=5`);
      void profByEmail;
      console.log("!! no user_id linked to athlete_id");
      continue;
    }
    const authRes = await fetch(`${base}/auth/v1/admin/users/${uid}`, { headers });
    const authUser = await authRes.json().catch(() => null);
    console.log("AUTH", JSON.stringify({ email: authUser?.email, confirmed: authUser?.email_confirmed_at, last_sign_in: authUser?.last_sign_in_at }, null, 2));
    const subs = await get(`billing_subscriptions?user_id=eq.${uid}&select=*`);
    const cust = await get(`billing_customers?user_id=eq.${uid}&select=*`);
    const grants = await get(`subscription_grants?user_id=eq.${uid}&select=*`);
    console.log("billing_subscriptions", JSON.stringify(subs, null, 2));
    console.log("billing_customers", JSON.stringify(cust, null, 2));
    console.log("subscription_grants", JSON.stringify(grants, null, 2));
  }
}
