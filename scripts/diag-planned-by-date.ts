/**
 * Cerca planned_workouts per data (tutti gli atleti) — trova athlete_id reale se la seduta esiste.
 *
 *   npx tsx scripts/diag-planned-by-date.ts 2026-05-31
 *   npx tsx scripts/diag-planned-by-date.ts 2026-05-31 --env-file .env.vercel.production
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(absPath: string, overwrite = false): void {
  if (!existsSync(absPath)) return;
  for (const line of readFileSync(absPath, "utf8").split(/\r?\n/)) {
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
    if (key && (overwrite || process.env[key] === undefined)) process.env[key] = val;
  }
}

function loadEnv(): void {
  const root = resolve(__dirname, "..");
  loadEnvFile(resolve(root, "apps/web/.env.local"));
  loadEnvFile(resolve(root, ".env.local"));
  for (let i = 3; i < process.argv.length; i++) {
    if (process.argv[i] === "--env-file" && process.argv[i + 1]) {
      loadEnvFile(resolve(process.cwd(), process.argv[i + 1]), true);
      i++;
    }
  }
}

async function main(): Promise<void> {
  const date = process.argv[2]?.trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error("Uso: npx tsx scripts/diag-planned-by-date.ts YYYY-MM-DD [--env-file path]");
    process.exit(1);
  }
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Mancano env Supabase");
    process.exit(1);
  }
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* ignore */
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("planned_workouts")
    .select("id, athlete_id, date, type, created_at, notes")
    .eq("date", date)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`\nSupabase: ${host}`);
  console.log(`data seduta: ${date}`);
  console.log(`righe totali (max 100): ${data?.length ?? 0}\n`);

  for (const r of data ?? []) {
    const notes = String(r.notes ?? "");
    const virya = notes.match(/\[VIRYA:[^\]]+\]/)?.[0] ?? null;
    console.log({
      athlete_id: r.athlete_id,
      id: r.id,
      type: r.type,
      created_at: r.created_at,
      virya,
      hasBuilder: notes.includes("BUILDER_SESSION_JSON"),
    });
  }
}

void main();
