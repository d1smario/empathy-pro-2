/**
 * Cancella planned + executed nel mese indicato per un utente (email → athlete_id).
 * Usa SUPABASE_SERVICE_ROLE_KEY da apps/web/.env.local o .env.local (root).
 *
 * Uso (da root repo):
 *   npx tsx scripts/reset-athlete-training-month.ts rova.ma79@gmail.com 2026 5
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(absPath: string): void {
  if (!existsSync(absPath)) return;
  const raw = readFileSync(absPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    val = val.trim().replace(/\\n/g, "");
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

function monthBounds(year: number, month1to12: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(year, month1to12, 0).getDate();
  return {
    from: `${year}-${pad(month1to12)}-01`,
    to: `${year}-${pad(month1to12)}-${pad(last)}`,
  };
}

async function main() {
  const root = resolve(__dirname, "..");
  loadEnvFile(resolve(root, "apps/web/.env.local"));
  loadEnvFile(resolve(root, ".env.local"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Manca NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY negli env.");
    process.exit(1);
  }

  const emailArg = process.argv[2]?.trim().toLowerCase();
  const year = Number(process.argv[3]);
  const month = Number(process.argv[4]);
  if (!emailArg || !Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    console.error(
      "Uso: npx tsx scripts/reset-athlete-training-month.ts <email> <anno> <mese 1-12>",
    );
    process.exit(1);
  }

  const { from, to } = monthBounds(year, month);
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | null = null;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === emailArg);
    if (u) {
      userId = u.id;
      break;
    }
    if (!data.users.length) break;
  }

  let athleteId: string | null = null;
  if (userId) {
    const { data: aup, error: aupErr } = await supabase
      .from("app_user_profiles")
      .select("athlete_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (aupErr) throw aupErr;
    athleteId = (aup?.athlete_id as string | undefined) ?? null;
  }
  if (!athleteId) {
    const { data: rows, error: apErr } = await supabase
      .from("athlete_profiles")
      .select("id")
      .ilike("email", emailArg)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (apErr) throw apErr;
    athleteId = (rows?.[0]?.id as string | undefined) ?? null;
  }

  if (!athleteId) {
    console.error(`Nessun athlete_id per ${emailArg}`);
    process.exit(1);
  }

  const { data: delExec, error: exErr } = await supabase
    .from("executed_workouts")
    .delete()
    .eq("athlete_id", athleteId)
    .gte("date", from)
    .lte("date", to)
    .select("id");
  if (exErr) throw exErr;

  const { data: delPlan, error: plErr } = await supabase
    .from("planned_workouts")
    .delete()
    .eq("athlete_id", athleteId)
    .gte("date", from)
    .lte("date", to)
    .select("id");
  if (plErr) throw plErr;

  console.log(
    JSON.stringify(
      {
        email: emailArg,
        athleteId,
        window: { from, to },
        deletedExecuted: delExec?.length ?? 0,
        deletedPlanned: delPlan?.length ?? 0,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
