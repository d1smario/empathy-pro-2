/**
 * Replica lettura calendario: planned + executed per giorno.
 * npx tsx scripts/diag-day-window.ts <athleteId> <date> [--env-file .env.vercel.production]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(absPath: string): void {
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
    process.env[key] = val;
  }
}

async function main(): Promise<void> {
  const athleteId = process.argv[2]?.trim();
  const date = process.argv[3]?.trim();
  if (!athleteId || !date) {
    console.error("Uso: diag-day-window.ts <athleteId> YYYY-MM-DD [--env-file path]");
    process.exit(1);
  }
  const root = resolve(__dirname, "..");
  loadEnvFile(resolve(root, "apps/web/.env.local"));
  for (let i = 4; i < process.argv.length; i++) {
    if (process.argv[i] === "--env-file" && process.argv[i + 1]) {
      loadEnvFile(resolve(process.cwd(), process.argv[i + 1]));
      i++;
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const p = await sb
    .from("planned_workouts")
    .select("id, type, duration_minutes, tss_target, notes, created_at")
    .eq("athlete_id", athleteId)
    .eq("date", date);
  const e = await sb
    .from("executed_workouts")
    .select("id, duration_minutes, tss, source, external_id, created_at")
    .eq("athlete_id", athleteId)
    .eq("date", date);

  console.log(
    JSON.stringify(
      {
        host: new URL(url).hostname,
        date,
        planned: { error: p.error?.message ?? null, rows: p.data ?? [] },
        executed: { error: e.error?.message ?? null, rows: e.data ?? [] },
      },
      null,
      2,
    ),
  );
}

void main();
