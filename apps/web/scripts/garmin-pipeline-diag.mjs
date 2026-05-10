/**
 * Diagnostica end-to-end pipeline Garmin per un atleta.
 *
 * Uso (da `apps/web`, PowerShell):
 *   node scripts/garmin-pipeline-diag.mjs <athlete_uuid>
 *
 * Legge `.env.local` (in apps/web) per `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
 *
 * Read-only. Non modifica nulla.
 *
 * Risponde a "le wellness Garmin arrivano?" guardando in ordine:
 *   1) garmin_push_receipts: cosa Garmin ha effettivamente pushato (per stream, ultime 48h).
 *   2) garmin_pull_jobs: cosa è stato accodato e con quale esito (status, http_status, error_message).
 *   3) device_sync_exports provider=garmin: righe wellness materializzate.
 *   4) executed_workouts source=api_sync:garmin:activities: attività materializzate.
 *
 * Se (1) > 0 ma (3)/(4) = 0 → bug nostro nel pull/materializer.
 * Se (1) = 0 → Garmin non sta inviando (sleeps/hrv/dailies arrivano solo con nuova nottata + sync).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadEnv(p) {
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/[\r\n]+/g, "").trim();
    if (!(k in process.env) || process.env[k] === "") process.env[k] = v;
  }
}

loadEnv(resolve(__dirname, "..", ".env.local"));
loadEnv(resolve(__dirname, "..", "..", "..", ".env.local"));

const BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!BASE || !KEY) {
  console.error("Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exitCode = 1;
}

const athleteId = (process.argv[2] || "").trim();
if (!UUID_RE.test(athleteId)) {
  console.error("Uso: node scripts/garmin-pipeline-diag.mjs <athlete_uuid>");
  process.exitCode = 1;
}

async function rest(path) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data: j };
}

function isoMinus(hours) {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function tally(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r) ?? "(unknown)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
}

async function main() {
  console.log(`Garmin pipeline diag for athlete ${athleteId}`);
  console.log(`Supabase: ${BASE}`);
  console.log("");

  const linkRes = await rest(
    `garmin_athlete_links?select=garmin_user_id,user_permissions,created_at,updated_at,token_expires_at&athlete_id=eq.${athleteId}`,
  );
  const links = Array.isArray(linkRes.data) ? linkRes.data : [];
  console.log(`[1] garmin_athlete_links: ${links.length} link(s)`);
  for (const l of links) {
    console.log(
      `    garmin_user_id=${l.garmin_user_id} permissions=${JSON.stringify(l.user_permissions ?? null)} linked_at=${l.created_at} token_exp=${l.token_expires_at}`,
    );
  }
  const garminUserId = links[0]?.garmin_user_id || null;
  console.log("");

  const since48h = isoMinus(48);
  const recRes = await rest(
    `garmin_push_receipts?select=id,endpoint_kind,content_type,created_at&created_at=gte.${since48h}&order=created_at.desc&limit=500`,
  );
  const receipts = Array.isArray(recRes.data) ? recRes.data : [];
  console.log(`[2] garmin_push_receipts (last 48h, all athletes): ${receipts.length}`);
  console.log("    by endpoint_kind:", tally(receipts, (r) => r.endpoint_kind));
  if (receipts.length > 0) {
    console.log(`    most recent: ${receipts[0].endpoint_kind} @ ${receipts[0].created_at}`);
  }
  console.log("");

  const since72h = isoMinus(72);
  const jobsRes = await rest(
    `garmin_pull_jobs?select=id,stream_key,endpoint_kind,status,http_status,error_message,created_at,updated_at,callback_url&athlete_id=eq.${athleteId}&created_at=gte.${since72h}&order=created_at.desc&limit=500`,
  );
  const jobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
  console.log(`[3] garmin_pull_jobs (athlete, last 72h): ${jobs.length}`);
  console.log("    by status:", tally(jobs, (r) => r.status));
  console.log("    by stream_key:", tally(jobs, (r) => r.stream_key));
  const failed = jobs.filter((j) => j.status === "failed").slice(0, 8);
  if (failed.length) {
    console.log(`    failed examples (${failed.length} shown):`);
    for (const f of failed) {
      const cb = String(f.callback_url || "").slice(0, 120);
      const err = String(f.error_message || "").slice(0, 160);
      console.log(`      [${f.stream_key}] http=${f.http_status} err=${err} url=${cb}`);
    }
  }
  const pending = jobs.filter((j) => j.status === "pending");
  if (pending.length) {
    console.log(`    pending: ${pending.length} (oldest ${pending[pending.length - 1]?.created_at})`);
  }
  console.log("");

  const since14d = isoMinus(24 * 14);
  const exRes = await rest(
    `device_sync_exports?select=provider,sync_kind,external_event_id,external_ref,payload,created_at&athlete_id=eq.${athleteId}&provider=eq.garmin&created_at=gte.${since14d}&order=created_at.desc&limit=500`,
  );
  const exports_ = Array.isArray(exRes.data) ? exRes.data : [];
  console.log(`[4] device_sync_exports (garmin, last 14d): ${exports_.length}`);
  console.log(
    "    by stream (sourcePayload.garmin_wellness_stream):",
    tally(exports_, (r) => (r.payload && typeof r.payload === "object" && r.payload.sourcePayload ? r.payload.sourcePayload.garmin_wellness_stream : null)),
  );
  console.log("    by sync_kind:", tally(exports_, (r) => r.sync_kind));
  if (exports_.length) {
    console.log(`    most recent: ${exports_[0].external_event_id ?? exports_[0].external_ref} @ ${exports_[0].created_at}`);
  }
  console.log("");

  const since30d = isoMinus(24 * 30);
  const wkRes = await rest(
    `executed_workouts?select=id,date,duration_minutes,tss,kcal,external_id,source,trace_summary&athlete_id=eq.${athleteId}&source=like.api_sync:garmin*&date=gte.${since30d.slice(0, 10)}&order=date.desc&limit=200`,
  );
  const workouts = Array.isArray(wkRes.data) ? wkRes.data : [];
  console.log(`[5] executed_workouts (garmin, last 30d): ${workouts.length}`);
  if (workouts.length) {
    const w = workouts[0];
    const trace = w.trace_summary && typeof w.trace_summary === "object" ? w.trace_summary : {};
    const hasSamples = Object.keys(trace).some((k) => k.endsWith("_series_w") || k.endsWith("_series_bpm") || k.endsWith("_series_kmh") || k.endsWith("_series_rpm") || k.endsWith("_series_m") || k.endsWith("_series_c"));
    console.log(`    most recent: date=${w.date} dur=${w.duration_minutes}min tss=${w.tss} kcal=${w.kcal}`);
    console.log(`    parser_engine=${trace.parser_engine} parser_version=${trace.parser_version} hd_samples_in_trace=${hasSamples}`);
  }

  const idsCsv = workouts
    .slice(0, 20)
    .map((w) => `"${w.id}"`)
    .join(",");
  if (idsCsv.length) {
    const seriesRes = await rest(
      `executed_workout_series?select=executed_workout_id,channel,sample_count,parser_engine&executed_workout_id=in.(${idsCsv})&limit=400`,
    );
    const series = Array.isArray(seriesRes.data) ? seriesRes.data : [];
    console.log(`[6] executed_workout_series rows for last 20 sessions: ${series.length}`);
    console.log("    by channel:", tally(series, (r) => r.channel));
    console.log("    by parser_engine:", tally(series, (r) => r.parser_engine));
  }
  console.log("");

  console.log("VERDETTO RAPIDO");
  if (receipts.length === 0) {
    console.log("- Nessun push Garmin nelle ultime 48h. Atteso se non ci sono nuovi sleeps/HRV/dailies (Garmin pusha solo nuovi aggregati).");
    console.log("  Per provarlo: indossa il Garmin tutta la notte, sincronizza la mattina con Garmin Connect, attendi 5–15 min e rilancia questo script.");
  } else {
    const counts = tally(receipts, (r) => r.endpoint_kind);
    const wellnessKinds = Object.keys(counts).filter((k) => /(sleep|hrv|daily|dailies|stress|pulseox|userMetrics|skinTemp|respir)/i.test(k));
    if (wellnessKinds.length === 0) {
      console.log("- Push presenti ma solo activity-related: Garmin non sta ancora pushando wellness. Vedi nota sleeps/HRV.");
    } else {
      const wellnessExports = exports_.length;
      if (wellnessExports === 0) {
        console.log("- Push wellness arrivati ma nessuna riga device_sync_exports: probabile errore in pull/materializer.");
        console.log("  Controlla [3] failed examples sopra; se http=4xx → token/URL; se http=5xx o error_message specifico → bug.");
      } else {
        console.log(`- Push wellness arrivati e ${wellnessExports} righe device_sync_exports persistite. UI Physiology / Calendar dovrebbero vederle.`);
      }
    }
  }
}

main().catch((err) => {
  console.error("DIAG FATAL:", err?.message ?? err);
  process.exitCode = 1;
});
