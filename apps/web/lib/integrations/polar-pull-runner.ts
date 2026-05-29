import "server-only";

import type { ObservationIngestTags, RealityDomain } from "@/lib/empathy/schemas";
import { observationDomainsFromPolarPayload } from "@/lib/integrations/polar-observation-from-payload";
import { POLAR_V3_PATHS, polarApiBaseUrl } from "@/lib/integrations/polar-oauth2-api";
import { readVendorOauthTokens } from "@/lib/integrations/vendor-oauth-read";
import { persistRealityDeviceExport } from "@/lib/reality/provider-adapters";
import { defaultObservationIngestTags } from "@/lib/reality/observation-ingest-defaults";
import { mergeObservationIngestTags } from "@/lib/reality/observation-merge";
import { buildExecutedTrainingImportQuality } from "@/lib/reality/training-import-quality";
import { upsertExecutedWorkoutByExternalId } from "@/lib/training/executed/upsert-executed-workout";
import { buildScalarRepresentativeHrSeriesBpm } from "@/lib/training/executed/executed-workout-session-times";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { readOptionalServiceRoleKey } from "@/lib/supabase-env";
import { getMergedIngestStreams } from "@/lib/integrations/ingest-stream-policy";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Estrae una lista da una risposta Polar (array diretto o oggetto con chiave `key`). */
function extractPolarList(json: unknown, key: string): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.filter((x): x is Record<string, unknown> => asRecord(x) != null);
  const obj = asRecord(json);
  if (!obj) return [];
  const arr = obj[key] ?? obj.data;
  if (Array.isArray(arr)) return arr.filter((x): x is Record<string, unknown> => asRecord(x) != null);
  return [];
}

/** Durata ISO-8601 (es. `PT2H44M`, `PT45M30S`) → minuti arrotondati. */
function isoDurationToMinutes(raw: unknown): number {
  if (typeof raw !== "string") return 0;
  const m = raw.match(/^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return 0;
  const days = Number(m[1] ?? 0);
  const hours = Number(m[2] ?? 0);
  const minutes = Number(m[3] ?? 0);
  const seconds = Number(m[4] ?? 0);
  const total = days * 1440 + hours * 60 + minutes + seconds / 60;
  return total > 0 ? Math.max(1, Math.round(total)) : 0;
}

function dayFromIso(v: unknown): string | null {
  return typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null;
}

function isDuplicateExportError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("duplicate") || m.includes("23505") || m.includes("unique") || m.includes("uq_device_sync_exports");
}

function buildPolarObservation(
  rec: Record<string, unknown>,
  domain: RealityDomain,
  day: string | null,
): ObservationIngestTags {
  const base = defaultObservationIngestTags({
    provider: "polar",
    domain,
    sourceKind: "api_sync",
    channelCoverage: null,
  });
  const doms = observationDomainsFromPolarPayload(rec);
  const fallback: ObservationIngestTags = {
    domains:
      doms.length > 0
        ? doms
        : domain === "training"
          ? ["exertion_physiological_load"]
          : domain === "sleep"
            ? ["sleep_timing_duration"]
            : ["autonomic_recovery_state"],
    modalities: ["daily_aggregate", "epoch_summary"],
    contextRefs: null,
  };
  let observation = base != null ? mergeObservationIngestTags(base, { domains: doms }) : fallback;
  if (day) {
    observation = mergeObservationIngestTags(observation, { contextRefs: [{ kind: "calendar_day", date: day }] });
  }
  return observation;
}

async function readPolarAccessToken(athleteId: string): Promise<string> {
  const row = await readVendorOauthTokens(athleteId, "polar");
  if (!row) throw new Error("Polar non collegato per questo atleta (vendor_oauth_links).");
  return row.accessToken;
}

async function fetchPolarJson(accessToken: string, path: string): Promise<unknown> {
  const url = `${polarApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  // 204 = nessun dato disponibile.
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`polar_${path}_http_${res.status}:${text.slice(0, 500)}`);
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`polar_${path}_parse:${text.slice(0, 300)}`);
  }
}

function polarExerciseSessionTimes(rec: Record<string, unknown>, durationMinutes: number): {
  started_at: string;
  ended_at: string;
} | null {
  const start = rec.start_time;
  if (typeof start !== "string" || start.length < 19) return null;
  const offsetMin = num(rec.start_time_utc_offset);
  // start_time è local senza timezone: applica offset per ottenere ISO con zona.
  let iso = start;
  if (offsetMin != null) {
    const sign = offsetMin >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMin);
    const hh = String(Math.floor(abs / 60)).padStart(2, "0");
    const mm = String(abs % 60).padStart(2, "0");
    iso = `${start}${sign}${hh}:${mm}`;
  } else {
    iso = `${start}Z`;
  }
  const startMs = Date.parse(iso);
  if (!Number.isFinite(startMs)) return null;
  const endMs = startMs + durationMinutes * 60000;
  return { started_at: new Date(startMs).toISOString(), ended_at: new Date(endMs).toISOString() };
}

async function upsertExecutedWorkoutFromPolarExercise(input: {
  athleteId: string;
  exerciseId: string;
  day: string | null;
  rec: Record<string, unknown>;
}): Promise<void> {
  const date = input.day;
  if (!date) return;
  const durationMinutes = isoDurationToMinutes(input.rec.duration);
  if (durationMinutes <= 0) return;
  const hr = asRecord(input.rec.heart_rate);
  const hrAvg = num(hr?.average);
  const hrMax = num(hr?.maximum);
  const trainingLoad = num(input.rec.training_load);
  const tss = trainingLoad != null && trainingLoad > 0 ? Math.round(trainingLoad) : 0;
  const kcal = num(input.rec.calories);
  const distanceM = num(input.rec.distance);
  const channelCoverage: Record<string, number> = {
    power: 0,
    hr: hrAvg != null || hrMax != null ? 100 : 0,
    speed: distanceM != null ? 100 : 0,
    cadence: 0,
    altitude: 0,
    temperature: 0,
  };
  const quality = buildExecutedTrainingImportQuality({ channelCoverage });
  const source = "api_sync:polar:exercise";
  const supabase = createServerSupabaseClient();
  const sessionTimes = polarExerciseSessionTimes(input.rec, durationMinutes);
  const hrSeries = hrAvg != null ? buildScalarRepresentativeHrSeriesBpm({ durationMinutes, avgBpm: hrAvg, maxBpm: hrMax }) : [];
  const traceSummary: Record<string, unknown> = {
    parser_engine: "polar_v3_rest_exercise",
    parser_version: "3",
    source,
    polar_exercise_id: input.exerciseId,
    sport_name: input.rec.detailed_sport_info ?? input.rec.sport ?? null,
    training_load: trainingLoad,
    average_heart_rate: hrAvg,
    max_heart_rate: hrMax,
    hr_avg_bpm: hrAvg,
    hr_max_bpm: hrMax,
    distance_m: distanceM,
    kcal,
    ...(sessionTimes ? { workout_start_iso: sessionTimes.started_at, workout_end_iso: sessionTimes.ended_at } : {}),
    ...(hrSeries.length >= 2 ? { hr_series_bpm: hrSeries, hr_series_bpm_source: "polar_scalar_representation" } : {}),
    channels_available: Object.fromEntries(Object.entries(channelCoverage).map(([k, v]) => [k, v > 0])) as Record<
      string,
      boolean
    >,
    import_quality: {
      coverage_pct: quality.coveragePct,
      quality_status: quality.qualityStatus,
      quality_note: quality.qualityNote,
      missing_channels: quality.missingChannels,
      recommended_inputs: quality.recommendedInputs,
      channel_coverage_pct: channelCoverage,
    },
  };
  if (hrSeries.length >= 2) {
    (traceSummary.channels_available as Record<string, boolean>).hr = true;
  }
  await upsertExecutedWorkoutByExternalId(supabase, {
    athlete_id: input.athleteId,
    date,
    ...(sessionTimes ? { started_at: sessionTimes.started_at, ended_at: sessionTimes.ended_at } : {}),
    duration_minutes: durationMinutes,
    tss,
    kcal,
    kj: null,
    source,
    external_id: `polar:${input.exerciseId}`,
    trace_summary: traceSummary,
    subjective_notes: null as string | null,
  });
}

async function persistPolarRecords(input: {
  athleteId: string;
  records: Record<string, unknown>[];
  domain: RealityDomain;
  payloadKey: string;
  idFor: (rec: Record<string, unknown>) => string | null;
  previewKeys: string[];
  materializeTraining?: boolean;
}): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;

  for (const rec of input.records) {
    const id = input.idFor(rec);
    if (!id) continue;
    const day = dayFromIso(rec.start_time) ?? dayFromIso(rec.date) ?? null;
    const observation = buildPolarObservation(rec, input.domain, day);
    const preview: Record<string, unknown> = { polar_id: id };
    for (const k of input.previewKeys) {
      if (k in rec) preview[k] = rec[k];
    }

    try {
      let exportOk = false;
      try {
        await persistRealityDeviceExport({
          athleteId: input.athleteId,
          provider: "polar",
          domain: input.domain,
          sourceKind: "api_sync",
          externalRef: id,
          payload: { [input.payloadKey]: rec },
          canonicalPreview: preview,
          status: "created",
          parserEngine: "polar_v3_rest",
          parserVersion: "3",
          observation,
        });
        exportOk = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!isDuplicateExportError(msg)) throw e;
        skipped += 1;
      }
      if (input.materializeTraining && input.domain === "training") {
        await upsertExecutedWorkoutFromPolarExercise({ athleteId: input.athleteId, exerciseId: id, day, rec });
      }
      if (exportOk) inserted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`[${input.domain}] ${msg}`);
    }
  }

  return { inserted, skipped, errors };
}

export type PolarPullStreams = {
  exercise?: boolean;
  sleep?: boolean;
  recharge?: boolean;
};

/**
 * Pull Polar AccessLink (exercises, sleep, nightly-recharge) → `device_sync_exports`.
 * Endpoint v3 diretti con Bearer token utente; gli allenamenti vengono materializzati in
 * `executed_workouts`. Sempre intersecato con `athlete_device_ingest_policy` (chiavi polar_*).
 */
export async function runPolarPullForAthlete(input: {
  athleteId: string;
  streams?: PolarPullStreams | null;
}): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const policy = await getMergedIngestStreams(input.athleteId, "polar");
  const req = input.streams ?? {};
  const streams: Required<PolarPullStreams> = {
    exercise: Boolean(policy.polar_exercise && (req.exercise ?? true)),
    sleep: Boolean(policy.polar_sleep && (req.sleep ?? true)),
    recharge: Boolean(policy.polar_recharge && (req.recharge ?? true)),
  };
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;

  if (!streams.exercise && !streams.sleep && !streams.recharge) {
    return { inserted: 0, skipped: 0, errors };
  }

  const access = await readPolarAccessToken(input.athleteId);

  const runStream = async (
    enabled: boolean,
    path: string,
    listKey: string,
    domain: RealityDomain,
    payloadKey: string,
    idFor: (rec: Record<string, unknown>) => string | null,
    previewKeys: string[],
    materializeTraining = false,
  ) => {
    if (!enabled) return;
    try {
      const json = await fetchPolarJson(access, path);
      const records = extractPolarList(json, listKey);
      const r = await persistPolarRecords({
        athleteId: input.athleteId,
        records,
        domain,
        payloadKey,
        idFor,
        previewKeys,
        materializeTraining,
      });
      inserted += r.inserted;
      skipped += r.skipped;
      errors.push(...r.errors);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  };

  const exerciseId = (rec: Record<string, unknown>) => (typeof rec.id === "string" ? rec.id : null);
  const dateId = (prefix: string) => (rec: Record<string, unknown>) =>
    typeof rec.date === "string" && rec.date ? `${prefix}:${rec.date}` : null;

  await runStream(
    streams.exercise,
    POLAR_V3_PATHS.exercises,
    "exercises",
    "training",
    "polar_exercise",
    exerciseId,
    ["sport", "detailed_sport_info", "start_time", "duration"],
    true,
  );
  await runStream(
    streams.sleep,
    POLAR_V3_PATHS.sleep,
    "nights",
    "sleep",
    "polar_sleep",
    dateId("sleep"),
    ["date", "sleep_start_time", "sleep_end_time"],
  );
  await runStream(
    streams.recharge,
    POLAR_V3_PATHS.nightlyRecharge,
    "recharges",
    "recovery",
    "polar_nightly_recharge",
    dateId("recharge"),
    ["date", "heart_rate_variability_avg", "nightly_recharge_status"],
  );

  return { inserted, skipped, errors };
}

/**
 * Elabora fino a `limit` atleti con Polar collegato (`vendor_oauth_links`), `updated_at` ascendente.
 * Da `GET /api/integrations/polar/pull/cron` (Vercel Cron) con Bearer segreto.
 */
export async function runPolarPullCronBatch(limit: number): Promise<{
  processed: number;
  completed: number;
  failed: number;
  errors: string[];
  inserted: number;
  skipped: number;
}> {
  if (!readOptionalServiceRoleKey()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY richiesta per cron Polar.");
  }

  const supabase = createServerSupabaseClient();
  const cap = Math.min(25, Math.max(1, Math.floor(limit)));

  const { data: rows, error } = await supabase
    .from("vendor_oauth_links")
    .select("athlete_id, oauth_access_token")
    .eq("vendor", "polar")
    .order("updated_at", { ascending: true })
    .limit(cap);

  if (error) throw new Error(error.message);

  const candidates = (rows ?? []).filter((r) => {
    const a = typeof r.oauth_access_token === "string" ? r.oauth_access_token.trim() : "";
    return a.length > 0;
  });

  let processed = 0;
  let completed = 0;
  let failed = 0;
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of candidates) {
    const athleteId = typeof row.athlete_id === "string" ? row.athlete_id : "";
    if (!athleteId) continue;
    processed += 1;
    try {
      const result = await runPolarPullForAthlete({ athleteId });
      inserted += result.inserted;
      skipped += result.skipped;
      if (result.errors.length > 0) {
        errors.push(`${athleteId}: ${result.errors.slice(0, 5).join("; ")}`);
      }
      completed += 1;
    } catch (e) {
      failed += 1;
      errors.push(`${athleteId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { processed, completed, failed, errors, inserted, skipped };
}
