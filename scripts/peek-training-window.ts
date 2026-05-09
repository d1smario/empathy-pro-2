/**
 * Solo lettura: elenco executed_workouts in una finestra di date (diag rapido dopo import).
 *
 *   npx tsx scripts/peek-training-window.ts <athleteId> <from> <to>
 *   npx tsx scripts/peek-training-window.ts 917d... 2026-05-01 2026-05-31 --env-file .env.vercel.production
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(absPath: string, overwrite = false): void {
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
    if (key && (overwrite || process.env[key] === undefined)) process.env[key] = val;
  }
}

async function main() {
  const root = resolve(__dirname, "..");
  loadEnvFile(resolve(root, "apps/web/.env.local"));
  loadEnvFile(resolve(root, ".env.local"));

  for (let i = 5; i < process.argv.length; i++) {
    if (process.argv[i] === "--env-file" && process.argv[i + 1]) {
      loadEnvFile(resolve(process.cwd(), process.argv[i + 1]), true);
      i++;
    }
  }

  const athleteId = process.argv[2]?.trim();
  const from = process.argv[3]?.trim();
  const to = process.argv[4]?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!athleteId || !from || !to || !url || !key) {
    console.error(
      "Uso: npx tsx scripts/peek-training-window.ts <athleteId> <from YYYY-MM-DD> <to YYYY-MM-DD> [--env-file path]",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("executed_workouts")
    .select("id, date, duration_minutes, tss, source, external_id")
    .eq("athlete_id", athleteId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .limit(40);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* ignore */
  }

  console.log(
    JSON.stringify(
      {
        supabaseHost: host,
        athleteId,
        window: { from, to },
        rowCount: data?.length ?? 0,
        rows: data ?? [],
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
