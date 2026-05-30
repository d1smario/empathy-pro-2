import "server-only";

import type { ObservationIngestTags, RealityDomain } from "@/lib/empathy/schemas";
import { observationDomainsFromSuuntoPayload } from "@/lib/integrations/suunto-observation-from-payload";
import {
  exchangeSuuntoRefreshToken,
  SUUNTO_PATHS,
  suuntoApiBaseUrl,
  suuntoSubscriptionKey,
} from "@/lib/integrations/suunto-oauth2-api";
import { readVendorOauthTokens } from "@/lib/integrations/vendor-oauth-read";
import { updateVendorOauthTokens } from "@/lib/integrations/vendor-oauth-persist";
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

function extractSuuntoList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.filter((x): x is Record<string, unknown> => asRecord(x) != null);
  const obj = asRecord(json);
  if (!obj) return [];
  const arr = obj.payload ?? obj.workouts ?? obj.data;
  if (Array.isArray(arr)) return arr.filter((x): x is Record<string, unknown> => asRecord(x) != null);
  return [];
}

function isDuplicateExportError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("duplicate") || m.includes("23505") || m.includes("unique") || m.includes("uq_device_sync_exports");
}

function suuntoWorkoutId(rec: Record<string, unknown>): string | null {
  const k = rec.workoutKey ?? rec.workoutId ?? rec.id;
  if (typeof k === "string" && k.trim()) return k.trim();
  if (typeof k === "number" && Number.isFinite(k)) return String(k);
  return null;
}

function suuntoStartMs(rec: Record<string, unknown>): number | null {
  const s = num(rec.startTime) ?? num(rec.starttime);
  // Suunto startTime è epoch ms.
  return s != null && s > 0 ? s : null;
}

function suuntoDurationMinutes(rec: Record<string, unknown>): number {
  // totalTime in secondi (float).
  const sec = num(rec.totalTime) ?? num(rec.duration);
  if (sec != null && sec > 0) return Math.max(1, Math.round(sec / 60));
  return 0;
}

function buildSuuntoObservation(rec: Record<string, unknown>, domain: RealityDomain, day: string | null): ObservationIngestTags {
  const base = defaultObservationIngestTags({ provider: "suunto", domain, sourceKind: "api_sync", channelCoverage: null });
  const doms = observationDomainsFromSuuntoPayload(rec);
  const fallback: ObservationIngestTags = {
    domains: doms.length > 0 ? doms : ["exertion_physiological_load"],
    modalities: ["session_aggregate", "epoch_summary"],
    contextRefs: null,
  };
  let observation = base != null ? mergeObservationIngestTags(base, { domains: doms }) : fallback;
  if (day) observation = mergeObservationIngestTags(observation, { contextRefs: [{ kind: "calendar_day", date: day }] });
  return observation;
}

async function ensureSuuntoAccessToken(athleteId: string): Promise<string> {
  let row = await readVendorOauthTokens(athleteId, "suunto");
  if (!row) throw new Error("Suunto non collegato per questo atleta (vendor_oauth_links).");
  const now = Date.now();
  const expMs = row.expiresAt?.getTime() ?? 0;
  const expiringSoon = expMs > 0 && expMs < now + 5 * 60 * 1000;
  if (row.refreshToken && expiringSoon) {
    const tok = await exchangeSuuntoRefreshToken(row.refreshToken);
    if ("error" in tok) throw new Error(tok.error);
    const expiresAt =
      tok.expires_in != null && Number.isFinite(tok.expires_in)
        ? new Date(Date.now() + Math.max(0, tok.expires_in) * 1000)
        : null;
    const upd = await updateVendorOauthTokens({
      athleteId,
      vendor: "suunto",
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? row.refreshToken,
      expiresAt,
    });
    if (!upd.ok) throw new Error(upd.error);
    row = { accessToken: tok.access_token, refreshToken: tok.refresh_token ?? row.refreshToken, expiresAt };
  }
  return row.accessToken;
}

async function fetchSuuntoWorkouts(accessToken: string, subscriptionKey: string, sinceMs: number, untilMs: number): Promise<Record<string, unknown>[]> {
  const u = new URL(`${suuntoApiBaseUrl()}${SUUNTO_PATHS.workouts}`);
  u.searchParams.set("since", String(sinceMs));
  u.searchParams.set("until", String(untilMs));
  const res = await fetch(u.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (res.status === 204) return [];
  const text = await res.text();
  if (!res.ok) throw new Error(`suunto_workouts_http_${res.status}:${text.slice(0, 500)}`);
  if (!text.trim()) return [];
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`suunto_workouts_parse:${text.slice(0, 300)}`);
  }
  return extractSuuntoList(json);
}

async function upsertExecutedWorkoutFromSuunto(input: {
  athleteId: string;
  workoutId: string;
  day: string | null;
  startMs: number | null;
  rec: Record<string, unknown>;
}): Promise<void> {
  const date = input.day;
  if (!date) return;
  const durationMinutes = suuntoDurationMinutes(input.rec);
  if (durationMinutes <= 0) return;
  const hr = asRecord(input.rec.hrdata) ?? asRecord(input.rec.heartRate);
  const hrAvg = num(hr?.avg) ?? num(input.rec.avgHr) ?? num(input.rec.hravg);
  const hrMax = num(hr?.max) ?? num(input.rec.maxHr) ?? num(input.rec.hrmax);
  const kcal = num(input.rec.energyConsumption) ?? num(input.rec.energy);
  const distanceM = num(input.rec.totalDistance);
  const ascentM = num(input.rec.totalAscent);
  const channelCoverage: Record<string, number> = {
    power: num(input.rec.avgPower) != null ? 100 : 0,
    hr: hrAvg != null || hrMax != null ? 100 : 0,
    speed: distanceM != null ? 100 : 0,
    cadence: num(input.rec.cadence) != null ? 100 : 0,
    altitude: ascentM != null ? 100 : 0,
    temperature: 0,
  };
  const quality = buildExecutedTrainingImportQuality({ channelCoverage });
  const source = "api_sync:suunto:workout";
  const supabase = createServerSupabaseClient();
  const startedAt = input.startMs != null ? new Date(input.startMs).toISOString() : null;
  const endedAt = startedAt != null ? new Date(input.startMs! + durationMinutes * 60000).toISOString() : null;
  const hrSeries = hrAvg != null ? buildScalarRepresentativeHrSeriesBpm({ durationMinutes, avgBpm: hrAvg, maxBpm: hrMax }) : [];
  const traceSummary: Record<string, unknown> = {
    parser_engine: "suunto_v2_rest_workout",
    parser_version: "2",
    source,
    suunto_workout_id: input.workoutId,
    sport_id: input.rec.activityId ?? null,
    average_heart_rate: hrAvg,
    max_heart_rate: hrMax,
    hr_avg_bpm: hrAvg,
    hr_max_bpm: hrMax,
    distance_m: distanceM,
    elevation_gain_m: ascentM,
    kcal,
    ...(startedAt && endedAt ? { workout_start_iso: startedAt, workout_end_iso: endedAt } : {}),
    ...(hrSeries.length >= 2 ? { hr_series_bpm: hrSeries, hr_series_bpm_source: "suunto_scalar_representation" } : {}),
    channels_available: Object.fromEntries(Object.entries(channelCoverage).map(([k, v]) => [k, v > 0])) as Record<string, boolean>,
    import_quality: {
      coverage_pct: quality.coveragePct,
      quality_status: quality.qualityStatus,
      quality_note: quality.qualityNote,
      missing_channels: quality.missingChannels,
      recommended_inputs: quality.recommendedInputs,
      channel_coverage_pct: channelCoverage,
    },
  };
  if (hrSeries.length >= 2) (traceSummary.channels_available as Record<string, boolean>).hr = true;
  await upsertExecutedWorkoutByExternalId(supabase, {
    athlete_id: input.athleteId,
    date,
    ...(startedAt && endedAt ? { started_at: startedAt, ended_at: endedAt } : {}),
    duration_minutes: durationMinutes,
    tss: 0,
    kcal,
    kj: null,
    source,
    external_id: `suunto:${input.workoutId}`,
    trace_summary: traceSummary,
    subjective_notes: null as string | null,
  });
}

export type SuuntoPullStreams = { workout?: boolean };

/** Pull Suunto workouts (/v2/workouts) → device_sync_exports + executed_workouts. Range default: ultimi 28 giorni. */
export async function runSuuntoPullForAthlete(input: {
  athleteId: string;
  streams?: SuuntoPullStreams | null;
}): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const policy = await getMergedIngestStreams(input.athleteId, "suunto");
  const req = input.streams ?? {};
  const workoutEnabled = Boolean(policy.suunto_workout && (req.workout ?? true));
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;
  if (!workoutEnabled) return { inserted: 0, skipped: 0, errors };

  const subscriptionKey = suuntoSubscriptionKey();
  if (!subscriptionKey) throw new Error("SUUNTO_API_SUBSCRIPTION_KEY non configurato (Ocp-Apim-Subscription-Key).");

  const access = await ensureSuuntoAccessToken(input.athleteId);
  const untilMs = Date.now();
  const sinceMs = untilMs - 28 * 24 * 60 * 60 * 1000;

  let records: Record<string, unknown>[] = [];
  try {
    records = await fetchSuuntoWorkouts(access, subscriptionKey, sinceMs, untilMs);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { inserted, skipped, errors };
  }

  for (const rec of records) {
    const id = suuntoWorkoutId(rec);
    if (!id) continue;
    const startMs = suuntoStartMs(rec);
    const day = startMs != null ? new Date(startMs).toISOString().slice(0, 10) : null;
    const observation = buildSuuntoObservation(rec, "training", day);
    const preview: Record<string, unknown> = {
      suunto_workout_id: id,
      activityId: rec.activityId ?? null,
      startTime: rec.startTime ?? null,
      totalTime: rec.totalTime ?? null,
    };
    try {
      let exportOk = false;
      try {
        await persistRealityDeviceExport({
          athleteId: input.athleteId,
          provider: "suunto",
          domain: "training",
          sourceKind: "api_sync",
          externalRef: id,
          payload: { suunto_workout: rec },
          canonicalPreview: preview,
          status: "created",
          parserEngine: "suunto_v2_rest",
          parserVersion: "2",
          observation,
        });
        exportOk = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!isDuplicateExportError(msg)) throw e;
        skipped += 1;
      }
      await upsertExecutedWorkoutFromSuunto({ athleteId: input.athleteId, workoutId: id, day, startMs, rec });
      if (exportOk) inserted += 1;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return { inserted, skipped, errors };
}

export async function runSuuntoPullCronBatch(limit: number): Promise<{
  processed: number;
  completed: number;
  failed: number;
  errors: string[];
  inserted: number;
  skipped: number;
}> {
  if (!readOptionalServiceRoleKey()) throw new Error("SUPABASE_SERVICE_ROLE_KEY richiesta per cron Suunto.");
  const supabase = createServerSupabaseClient();
  const cap = Math.min(25, Math.max(1, Math.floor(limit)));
  const { data: rows, error } = await supabase
    .from("vendor_oauth_links")
    .select("athlete_id, oauth_access_token, oauth_refresh_token")
    .eq("vendor", "suunto")
    .order("updated_at", { ascending: true })
    .limit(cap);
  if (error) throw new Error(error.message);
  const candidates = (rows ?? []).filter((r) => {
    const a = typeof r.oauth_access_token === "string" ? r.oauth_access_token.trim() : "";
    const rf = typeof r.oauth_refresh_token === "string" ? r.oauth_refresh_token.trim() : "";
    return a.length > 0 || rf.length > 0;
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
      const result = await runSuuntoPullForAthlete({ athleteId });
      inserted += result.inserted;
      skipped += result.skipped;
      if (result.errors.length > 0) errors.push(`${athleteId}: ${result.errors.slice(0, 5).join("; ")}`);
      completed += 1;
    } catch (e) {
      failed += 1;
      errors.push(`${athleteId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { processed, completed, failed, errors, inserted, skipped };
}
