/**
 * Rimuove duplicati `planned_workouts` sullo stesso giorno (stessa fingerprint seduta).
 * Tiene la riga più recente per gruppo; elimina le altre.
 *
 * Uso: node scripts/dedupe-planned-workouts-date.mjs [YYYY-MM-DD] [athlete_id] [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const collapseBuilderType = args.includes("--collapse-builder-type");
const positional = args.filter((a) => a !== "--dry-run" && a !== "--collapse-builder-type");
const targetDate = (positional[0] ?? "2026-05-27").slice(0, 10);
const athleteIdFilter = (positional[1] ?? "").trim();

const envCandidates = [
  path.join(__dirname, "..", "..", "..", ".env.local.production"),
  path.join(__dirname, "..", "..", "..", ".env.local"),
  path.join(__dirname, "..", ".env.local"),
  path.join(__dirname, "..", ".env.local.production"),
];

let env = null;
for (const p of envCandidates) {
  if (!fs.existsSync(p)) continue;
  env = parseEnv(p);
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) break;
}
if (!env?.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase URL or service role key");
  process.exit(1);
}

const base = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const BUILDER_TAG = "BUILDER_SESSION_JSON::";

function plannedWorkoutDedupeFingerprint(row) {
  const notes = row.notes ?? "";
  const importMatch = notes.match(/\[EMPATHY_IMPORT:checksum=([a-f0-9]+)\]/i);
  if (importMatch) return `import:${importMatch[1]}`;

  const idx = notes.indexOf(BUILDER_TAG);
  if (idx >= 0) {
    const payload = notes.slice(idx + BUILDER_TAG.length).split(/\s*\|\s*/)[0]?.trim();
    if (payload) return `builder:${payload}`;
  }

  const kcal = row.kcal_target ?? 0;
  return `ops:${row.type}|${row.duration_minutes}|${row.tss_target}|${kcal}`;
}

function builderTitle(row) {
  const notes = row.notes ?? "";
  const idx = notes.indexOf(BUILDER_TAG);
  if (idx < 0) return null;
  try {
    const payload = notes.slice(idx + BUILDER_TAG.length).split(/\s*\|\s*/)[0]?.trim();
    const c = JSON.parse(decodeURIComponent(payload));
    return c.title ?? c.summary?.title ?? null;
  } catch {
    return null;
  }
}

let listUrl = `${base}/rest/v1/planned_workouts?date=eq.${encodeURIComponent(targetDate)}&select=id,athlete_id,date,type,duration_minutes,tss_target,kcal_target,notes,created_at&order=created_at.asc`;
if (athleteIdFilter) listUrl += `&athlete_id=eq.${encodeURIComponent(athleteIdFilter)}`;

const listRes = await fetch(listUrl, { headers });
if (!listRes.ok) {
  console.error("List failed:", listRes.status, await listRes.text());
  process.exit(1);
}
const rows = await listRes.json();
if (!Array.isArray(rows)) {
  console.error("Unexpected response:", rows);
  process.exit(1);
}

console.log(`Date ${targetDate}${athleteIdFilter ? ` athlete=${athleteIdFilter}` : ""}: ${rows.length} row(s)`);
for (const r of rows) {
  console.log(
    `  keep? id=${r.id} type=${r.type} ${r.duration_minutes}min tss=${r.tss_target} title=${builderTitle(r) ?? "—"} created=${r.created_at}`,
  );
}

const groups = new Map();
for (const row of rows) {
  const fp = `${row.athlete_id}|${row.date}|${plannedWorkoutDedupeFingerprint(row)}`;
  const list = groups.get(fp) ?? [];
  list.push(row);
  groups.set(fp, list);
}

const toDelete = [];
for (const [fp, list] of groups) {
  if (list.length <= 1) continue;
  const sorted = [...list].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const keep = sorted[sorted.length - 1];
  for (const row of sorted.slice(0, -1)) {
    toDelete.push({ row, keep, fp, reason: "exact_fingerprint" });
  }
}

if (collapseBuilderType) {
  const builderGroups = new Map();
  for (const row of rows) {
    if (!(row.notes ?? "").includes(BUILDER_TAG)) continue;
    const key = `${row.athlete_id}|${row.date}|${row.type}`;
    const list = builderGroups.get(key) ?? [];
    list.push(row);
    builderGroups.set(key, list);
  }
  const deleteIds = new Set(toDelete.map((d) => d.row.id));
  for (const [key, list] of builderGroups) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const keep = sorted[sorted.length - 1];
    for (const row of sorted.slice(0, -1)) {
      if (deleteIds.has(row.id)) continue;
      toDelete.push({ row, keep, fp: key, reason: "collapse_builder_type" });
      deleteIds.add(row.id);
    }
  }
}

if (toDelete.length === 0) {
  console.log("No duplicates to remove.");
  process.exit(0);
}

console.log(`\nRows to remove: ${toDelete.length}`);
for (const { row, keep, fp, reason } of toDelete) {
  console.log(`  DELETE ${row.id} (${reason}, keep ${keep.id}) key=${String(fp).slice(0, 80)}`);
}

if (dryRun) {
  console.log("\n--dry-run: no deletes performed.");
  process.exit(0);
}

let deleted = 0;
for (const { row } of toDelete) {
  const delRes = await fetch(`${base}/rest/v1/planned_workouts?id=eq.${encodeURIComponent(row.id)}`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=representation" },
  });
  if (!delRes.ok) {
    console.error("Delete failed:", row.id, delRes.status, await delRes.text());
    process.exit(1);
  }
  deleted += 1;
}

console.log(`Deleted ${deleted} duplicate row(s).`);
