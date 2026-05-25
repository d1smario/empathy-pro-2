/**
 * Cerca pattern nelle note planned per un atleta.
 * npx tsx scripts/diag-planned-notes-scan.ts <athleteId> [--env-file .env.vercel.production]
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
    process.env[key] = val;
  }
}

async function main(): Promise<void> {
  const root = resolve(__dirname, "..");
  loadEnvFile(resolve(root, "apps/web/.env.local"));
  for (let i = 3; i < process.argv.length; i++) {
    if (process.argv[i] === "--env-file" && process.argv[i + 1]) {
      loadEnvFile(resolve(process.cwd(), process.argv[i + 1]), true);
      i++;
    }
  }
  const athleteId = process.argv[2]?.trim();
  if (!athleteId) {
    console.error("Uso: diag-planned-notes-scan.ts <athleteId> [--env-file path]");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const patterns = [
    { label: "VIRYA bracket", pat: "%[VIRYA:%" },
    { label: "virya lowercase", pat: "%virya%" },
    { label: "BUILDER_SESSION", pat: "%BUILDER_SESSION_JSON%" },
    { label: "EMPATHY_CAL", pat: "%EMPATHY_CAL%" },
    { label: "Ciclismo 2026", pat: "%Ciclismo · 2026%" },
  ];

  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* ignore */
  }
  console.log({ host, athleteId });

  for (const { label, pat } of patterns) {
    const { data, count, error } = await sb
      .from("planned_workouts")
      .select("id, date, created_at, type", { count: "exact" })
      .eq("athlete_id", athleteId)
      .ilike("notes", pat)
      .order("date", { ascending: false })
      .limit(5);
    if (error) {
      console.log(label, "ERR", error.message);
      continue;
    }
    console.log(`\n${label}: count=${count ?? data?.length ?? 0}`);
    for (const r of data ?? []) console.log(r);
  }

  const { data: dupDates } = await sb.rpc("admin_athlete_activity_rollups" as never, {} as never).limit(0);
  void dupDates;

  const { data: all } = await sb
    .from("planned_workouts")
    .select("date")
    .eq("athlete_id", athleteId)
    .gte("date", "2026-04-01")
    .lte("date", "2026-06-30");
  const byDate = new Map<string, number>();
  for (const r of all ?? []) {
    const d = String(r.date).slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + 1);
  }
  const multi = [...byDate.entries()].filter(([, n]) => n > 1).sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`\nGiorni con 2+ righe (apr-giu 2026): ${multi.length}`);
  for (const [d, n] of multi.slice(0, 15)) console.log(`  ${d}: ${n} righe`);
  if (multi.length > 15) console.log(`  ... +${multi.length - 15} altri`);
}

void main();
