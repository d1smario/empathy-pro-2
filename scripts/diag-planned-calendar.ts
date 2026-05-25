/**
 * Diagnostica: chi può SCRIVERE su planned_workouts e cosa c'è in DB (VIRYA).
 *
 * Solo lettura sul DB (service role da env). Non rigenera nulla.
 *
 *   npx tsx scripts/diag-planned-calendar.ts writers
 *
 *   npx tsx scripts/diag-planned-calendar.ts peek <athleteId> <from> <to>
 *   npx tsx scripts/diag-planned-calendar.ts peek <athleteId> 2026-05-01 2026-05-31
 *   npx tsx scripts/diag-planned-calendar.ts peek <athleteId> 2026-05-31 2026-05-31
 *
 * Env: apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const WRITERS = [
  {
    source: "VIRYA → Salva su Calendar",
    api: "POST /api/training/planned (rows[] + replaceTag)",
    code: "ViryaAnnualPlanOrchestrator → replaceTrainingPlannerCalendar",
    notesMarker: "[VIRYA:…] in notes",
  },
  {
    source: "Builder → Salva nel calendario",
    api: "POST /api/training/planned/insert",
    code: "TrainingBuilderRichPageView → insertPlannedWorkoutFromEngineSession",
    notesMarker: "BUILDER_SESSION_JSON in notes",
  },
  {
    source: "Libreria coach → Applica",
    api: "apply-library-template → insertSinglePlannedWorkout",
    code: "CoachWorkoutLibraryPanel",
    notesMarker: "—",
  },
  {
    source: "Calendario → Copia seduta",
    api: "POST /api/training/planned/clone",
    code: "CalendarPlannedBuilderDetail → clonePlannedWorkout",
    notesMarker: "copia id esistente",
  },
  {
    source: "Import file programmato",
    api: "POST /api/training/import-planned (e varianti)",
    code: "training-planned-import-service",
    notesMarker: "—",
  },
  {
    source: "PATCH singola riga",
    api: "PATCH /api/training/planned",
    code: "sposta data / note (non crea piano VIRYA intero)",
    notesMarker: "—",
  },
] as const;

function loadEnvFromArgv(): void {
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

async function resolveAthleteIdByEmail(emailArg: string): Promise<string> {
  loadEnvFromArgv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Mancano NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
  }
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
  if (!athleteId) throw new Error(`Nessun athlete_id per ${emailArg}`);
  return athleteId;
}

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

function extractViryaTag(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/\[VIRYA:([^\]]+)\]/);
  return m ? `[VIRYA:${m[1]}]` : null;
}

function extractAuditSrc(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(/\[EMPATHY_CAL\|src=([^|]+)/);
  return m ? m[1]!.trim() : null;
}

function printWriters(): void {
  console.log("\n=== Chi può METTERE sedute su Calendar (planned_workouts) ===\n");
  console.log("Nessun job in background nel repo. Solo chiamate API / UI.\n");
  console.log("La memoria atleta (resolveAthleteMemory) NON inserisce righe qui.\n");
  for (const w of WRITERS) {
    console.log(`• ${w.source}`);
    console.log(`  API: ${w.api}`);
    console.log(`  Codice: ${w.code}`);
    console.log(`  Note tipiche: ${w.notesMarker}\n`);
  }
  console.log("Per intercettare LIVE: DevTools → Network → filtra `planned` → guarda POST dopo Elimina.\n");
  console.log(
    "Cerca nel repo:  rg \"planned_workouts\"\\\\).insert  apps/web -g \"*.{ts,tsx}\"\n",
  );
}

async function auditAthlete(athleteId: string): Promise<void> {
  loadEnvFromArgv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Mancano NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* ignore */
  }

  const { count: total, error: countErr } = await supabase
    .from("planned_workouts")
    .select("id", { count: "exact", head: true })
    .eq("athlete_id", athleteId);
  if (countErr) {
    console.error(countErr.message);
    process.exit(1);
  }

  const { data: recent, error: recErr } = await supabase
    .from("planned_workouts")
    .select("id, date, type, created_at, updated_at, notes")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (recErr) {
    console.error(recErr.message);
    process.exit(1);
  }

  const { data: virya, error: vErr } = await supabase
    .from("planned_workouts")
    .select("id, date, created_at, notes")
    .eq("athlete_id", athleteId)
    .ilike("notes", "%[VIRYA:%")
    .order("created_at", { ascending: false })
    .limit(50);
  if (vErr) {
    console.error(vErr.message);
    process.exit(1);
  }

  const may2026 = (recent ?? []).filter((r) => String(r.date ?? "").startsWith("2026-05"));

  console.log(`\n=== AUDIT planned_workouts ===`);
  console.log(`Supabase: ${host}`);
  console.log(`athlete_id: ${athleteId}`);
  console.log(`totale righe: ${total ?? 0}`);
  console.log(`righe con [VIRYA:…]: ${virya?.length ?? 0}`);
  console.log(`nel campione recente (40): in 2026-05 → ${may2026.length}\n`);

  console.log("--- Ultime righe (max 40) ---");
  for (const r of recent ?? []) {
    const notes = typeof r.notes === "string" ? r.notes : "";
    console.log({
      date: r.date,
      created_at: r.created_at,
      updated_at: r.updated_at,
      virya: extractViryaTag(notes),
      auditSrc: extractAuditSrc(notes),
      type: r.type,
      id: r.id,
    });
  }

  if (virya?.length) {
    console.log("\n--- Tutte le VIRYA nel DB (max 50, per data seduta) ---");
    for (const r of virya) {
      const notes = typeof r.notes === "string" ? r.notes : "";
      console.log({
        date: r.date,
        created_at: r.created_at,
        tag: extractViryaTag(notes),
        id: r.id,
      });
    }
  }
  console.log("");
}

async function peekPlanned(athleteId: string, from: string, to: string): Promise<void> {
  loadEnvFromArgv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Mancano NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("planned_workouts")
    .select("id, athlete_id, date, type, duration_minutes, tss_target, notes, created_at, updated_at")
    .eq("athlete_id", athleteId)
    .gte("date", from)
    .lte("date", to)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = data ?? [];
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* ignore */
  }

  console.log(`\nSupabase: ${host}`);
  console.log(`athlete_id: ${athleteId}`);
  console.log(`finestra date: ${from} → ${to}`);
  console.log(`righe planned_workouts: ${rows.length}\n`);

  const byDate = new Map<string, typeof rows>();
  for (const r of rows) {
    const d = String(r.date ?? "").slice(0, 10);
    const arr = byDate.get(d) ?? [];
    arr.push(r);
    byDate.set(d, arr);
  }

  for (const [date, list] of [...byDate.entries()].sort()) {
    console.log(`--- ${date} (${list.length} riga/e) ---`);
    for (const r of list) {
      const notes = typeof r.notes === "string" ? r.notes : "";
      const tag = extractViryaTag(notes);
      const src = extractAuditSrc(notes);
      const title =
        notes.match(/BUILDER_SESSION_JSON/)?.[0] != null
          ? "contratto builder in notes"
          : notes.slice(0, 60).replace(/\s+/g, " ");
      console.log({
        id: r.id,
        created_at: r.created_at,
        updated_at: r.updated_at,
        type: r.type,
        min: r.duration_minutes,
        tss: r.tss_target,
        viryaTag: tag,
        auditSrc: src,
        hint: title,
      });
    }
    if (list.length > 1) {
      console.log(
        "  ⚠ più righe stesso giorno: Elimina una sola id non basta — usa purge VIRYA o «Tutto il piano VIRYA»",
      );
    }
  }

  const viryaRows = rows.filter((r) => extractViryaTag(typeof r.notes === "string" ? r.notes : null));
  if (viryaRows.length) {
    const tags = [...new Set(viryaRows.map((r) => extractViryaTag(String(r.notes))!).filter(Boolean))];
    console.log(`\nPiani VIRYA in finestra: ${viryaRows.length} righe, tag: ${tags.join(", ")}`);
    console.log(
      "Se created_at è DOPO la tua eliminazione → qualcuno ha di nuovo chiamato POST /api/training/planned (quasi sempre VIRYA Salva su Calendar).",
    );
  } else {
    console.log("\nNessun marker [VIRYA:…] in notes in questa finestra.");
  }
  console.log("");
}

async function main(): Promise<void> {
  const cmd = process.argv[2]?.trim() ?? "writers";

  if (cmd === "writers") {
    printWriters();
    return;
  }

  if (cmd === "who") {
    const athleteId = process.argv[3]?.trim();
    if (!athleteId) {
      console.error("Uso: who <athleteId>");
      process.exit(1);
    }
    loadEnvFromArgv();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      console.error("Mancano env Supabase");
      process.exit(1);
    }
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: ap } = await supabase
      .from("athlete_profiles")
      .select("id, email, display_name")
      .eq("id", athleteId)
      .maybeSingle();
    const { data: aup } = await supabase
      .from("app_user_profiles")
      .select("user_id, role")
      .eq("athlete_id", athleteId)
      .limit(3);
    let authEmail: string | null = null;
    const uid = aup?.[0]?.user_id as string | undefined;
    if (uid) {
      const { data: u } = await supabase.auth.admin.getUserById(uid);
      authEmail = u.user?.email ?? null;
    }
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      /* ignore */
    }
    console.log(
      JSON.stringify(
        { supabaseHost: host, athleteId, profile: ap, appUserProfiles: aup, authEmail },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === "resolve") {
    const email = process.argv[3]?.trim().toLowerCase();
    if (!email) {
      console.error("Uso: npx tsx scripts/diag-planned-calendar.ts resolve <email>");
      process.exit(1);
    }
    loadEnvFromArgv();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      /* ignore */
    }
    const athleteId = await resolveAthleteIdByEmail(email);
    console.log(JSON.stringify({ supabaseHost: host, email, athleteId }, null, 2));
    return;
  }

  if (cmd === "audit") {
    const emailOrId = process.argv[3]?.trim();
    if (!emailOrId) {
      console.error("Uso: audit <email|uuid>");
      process.exit(1);
    }
    const athleteId = emailOrId.includes("@")
      ? await resolveAthleteIdByEmail(emailOrId.toLowerCase())
      : emailOrId;
    await auditAthlete(athleteId);
    return;
  }

  if (cmd === "count") {
    const athleteId = process.argv[3]?.trim();
    if (!athleteId) {
      console.error("Uso: count <athleteId>");
      process.exit(1);
    }
    loadEnvFromArgv();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const supabase = createClient(url!, key!, { auth: { persistSession: false } });
    const { count, error } = await supabase
      .from("planned_workouts")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", athleteId);
    const apr = await supabase
      .from("planned_workouts")
      .select("id, date, type")
      .eq("athlete_id", athleteId)
      .gte("date", "2026-04-01")
      .lte("date", "2026-04-30")
      .limit(5);
    console.log({ host: new URL(url!).hostname, total: count, aprError: apr.error?.message, aprSample: apr.data });
    return;
  }

  if (cmd === "peek") {
    const athleteId = process.argv[3]?.trim();
    const from = process.argv[4]?.trim();
    const to = process.argv[5]?.trim();
    if (!athleteId || !from || !to) {
      console.error(
        "Uso peek: npx tsx scripts/diag-planned-calendar.ts peek <athleteId> <from YYYY-MM-DD> <to YYYY-MM-DD> [--env-file path]",
      );
      process.exit(1);
    }
    await peekPlanned(athleteId, from, to);
    return;
  }

  console.error("Comandi: writers | resolve <email> | audit <email|uuid> | peek <athleteId> <from> <to>");
  process.exit(1);
}

void main();
