import "server-only";

import type { ObservationIngestTags, RealityDomain } from "@/lib/empathy/schemas";
import { observationDomainsFromKarooPayload } from "@/lib/integrations/karoo-observation-from-payload";
import { exchangeKarooRefreshToken, karooActivitiesUrl } from "@/lib/integrations/karoo-oauth2-api";
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

function extractKarooList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json.filter((x): x is Record<string, unknown> => asRecord(x) != null);
  const obj = asRecord(json);
  if (!obj) return [];
  const arr = obj.activities ?? obj.data ?? obj.items ?? obj.results;
  if (Array.isArray(arr)) return arr.filter((x): x is Record<string, unknown> => asRecord(x) != null);
  return [];
}

function isDuplicateExportError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("duplicate") || m.includes("23505") || m.includes("unique") || m.includes("uq_device_sync_exports");
}

function karooActivityId(rec: Record<string, unknown>): string | null {
  const k = rec.id ?? rec.activityId ?? rec.activity_id ?? rec.uuid;
  if (typeof k === "string" && k.trim()) return k.trim();
  if (typeof k === "number" && Number.isFinite(k)) return String(k);
  return null;
}

function karooStartIso(rec: Record<string, unknown>): string | null {
  const s = rec.startTime ?? rec.start_time ?? rec.startedAt ?? rec.started_at ?? rec.date;
  if (typeof s === "string" && s.trim()) {
    const t = Date.parse(s);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  const ms = num(s);
  if (ms != null && ms > 0) return new Date(ms < 1e12 ? ms * 1000 : ms).toISOString();
  return null;
}

function karooDurationMinutes(rec: Record<string, unknown>): number {
  const sec = num(rec.movingTime) ?? num(rec.moving_time) ?? num(rec.duration) ?? num(rec.elapsedTime) ?? num(rec.totalTime);
  if (sec != null && sec > 0) return Math.max(1, Math.round(sec / 60));
  return 0;
}

function buildKarooObservation(rec: Record<string, unknown>, domain: RealityDomain, day: string | null): ObservationIngestTags {
  const base = defaultObservationIngestTags({ provider: "hammerhead", domain, sourceKind: "api_sync", channelCoverage: null });
  const doms = observationDomainsFromKarooPayload(rec);
  const fallback: ObservationIngestTags = {
    domains: doms.length > 0 ? doms : ["exertion_physiological_load"],
    modalities: ["session_aggregate", "epoch_summary"],
    contextRefs: null,
  };
  let observation = base != null ? mergeObservationIngestTags(base, { domains: doms }) : fallback;
  if (day) observation = mergeObservationIngestTags(observation, { contextRefs: [{ kind: "calendar_day", date: day }] });
  return observation;
}

async function ensureKarooAccessToken(athleteId: string): Promise<string> {
  let row = await readVendorOauthTokens(athleteId, "hammerhead");
  if (!row) throw new Error("Karoo non collegato per questo atleta (vendor_oauth_links).");
  const now = Date.now();
  const expMs = row.expiresAt?.getTime() ?? 0;
  const expiringSoon = expMs > 0 && expMs < now + 5 * 60 * 1000;
  if (row.refreshToken && expiringSoon) {
    const tok = await exchangeKarooRefreshToken(row.refreshToken);
    if ("error" in tok) throw new Error(tok.error);
    const expiresAt =
      tok.expires_in != null && Number.isFinite(tok.expires_in)
        ? new Date(Date.now() + Math.max(0, tok.expires_in) * 1000)
        : null;
    const upd = await updateVendorOauthTokens({
      athleteId,
      vendor: "hammerhead",
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? row.refreshToken,
      expiresAt,
    });
    if (!upd.ok) throw new Error(upd.error);
    row = { accessToken: tok.access_token, refreshToken: tok.refresh_token ?? row.refreshToken, expiresAt };
  }
  return row.accessToken;
}

async function fetchKarooActivities(accessToken: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(karooActivitiesUrl(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 204) return [];
  const text = await res.text();
  if (!res.ok) throw new Error(`karoo_activities_http_${res.status}:${text.slice(0, 500)}`);
  if (!text.trim()) return [];
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`karoo_activities_parse:${text.slice(0, 300)}`);
  }
  return extractKarooList(json);
}

async function upsertExecutedWorkoutFromKaroo(input: {
  athleteId: string;
  activityId: string;
  day: string | null;
  startIso: string | null;
  rec: Record<string, unknown>;
}): Promise<void> {
  const date = input.day;
  if (!date) return;
  const durationMinutes = karooDurationMinutes(input.rec);
  if (durationMinutes <= 0) return;
  const hrAvg = num(input.rec.averageHeartRate) ?? num(input.rec.avg_hr) ?? num(input.rec.avgHr);
  const hrMax = num(input.rec.maxHeartRate) ?? num(input.rec.max_hr) ?? num(input.rec.maxHr);
  const powerAvg = num(input.rec.averagePower) ?? num(input.rec.avg_power);
  const kcal = num(input.rec.calories) ?? num(input.rec.kcal);
  const kj = num(input.rec.kj) ?? num(input.rec.work);
  const distanceM = num(input.rec.distance);
  const ascentM = num(input.rec.elevationGain) ?? num(input.rec.elevation_gain) ?? num(input.rec.totalAscent);
  const cadence = num(input.rec.averageCadence) ?? num(input.rec.cadence);
  const channelCoverage: Record<string, number> = {
    power: powerAvg != null ? 100 : 0,
    hr: hrAvg != null || hrMax != null ? 100 : 0,
    speed: distanceM != null ? 100 : 0,
    cadence: cadence != null ? 100 : 0,
    altitude: ascentM != null ? 100 : 0,
    temperature: 0,
  };
  const quality = buildExecutedTrainingImportQuality({ channelCoverage });
  const source = "api_sync:karoo:activity";
  const supabase = createServerSupabaseClient();
  const startedAt = input.startIso;
  const endedAt = startedAt != null ? new Date(Date.parse(startedAt) + durationMinutes * 60000).toISOString() : null;
  const hrSeries = hrAvg != null ? buildScalarRepresentativeHrSeriesBpm({ durationMinutes, avgBpm: hrAvg, maxBpm: hrMax }) : [];
  const traceSummary: Record<string, unknown> = {
    parser_engine: "karoo_rest_activity",
    parser_version: "1",
    source,
    karoo_activity_id: input.activityId,
    sport: input.rec.sport ?? input.rec.type ?? null,
    average_heart_rate: hrAvg,
    max_heart_rate: hrMax,
    hr_avg_bpm: hrAvg,
    hr_max_bpm: hrMax,
    average_power_w: powerAvg,
    distance_m: distanceM,
    elevation_gain_m: ascentM,
    kcal,
    kj,
    ...(startedAt && endedAt ? { workout_start_iso: startedAt, workout_end_iso: endedAt } : {}),
    ...(hrSeries.length >= 2 ? { hr_series_bpm: hrSeries, hr_series_bpm_source: "karoo_scalar_representation" } : {}),
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
    kj,
    source,
    external_id: `karoo:${input.activityId}`,
    trace_summary: traceSummary,
    subjective_notes: null as string | null,
  });
}

export type KarooPullStreams = { activity?: boolean };

/** Pull Karoo activities → device_sync_exports + executed_workouts. */
export async function runKarooPullForAthlete(input: {
  athleteId: string;
  streams?: KarooPullStreams | null;
}): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const policy = await getMergedIngestStreams(input.athleteId, "hammerhead");
  const req = input.streams ?? {};
  const activityEnabled = Boolean(policy.karoo_activity && (req.activity ?? true));
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;
  if (!activityEnabled) return { inserted: 0, skipped: 0, errors };

  const access = await ensureKarooAccessToken(input.athleteId);

  let records: Record<string, unknown>[] = [];
  try {
    records = await fetchKarooActivities(access);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { inserted, skipped, errors };
  }

  for (const rec of records) {
    const id = karooActivityId(rec);
    if (!id) continue;
    const startIso = karooStartIso(rec);
    const day = startIso != null ? startIso.slice(0, 10) : null;
    const observation = buildKarooObservation(rec, "training", day);
    const preview: Record<string, unknown> = {
      karoo_activity_id: id,
      sport: rec.sport ?? rec.type ?? null,
      startTime: rec.startTime ?? rec.start_time ?? null,
      distance: rec.distance ?? null,
    };
    try {
      let exportOk = false;
      try {
        await persistRealityDeviceExport({
          athleteId: input.athleteId,
          provider: "hammerhead",
          domain: "training",
          sourceKind: "api_sync",
          externalRef: id,
          payload: { karoo_activity: rec },
          canonicalPreview: preview,
          status: "created",
          parserEngine: "karoo_rest",
          parserVersion: "1",
          observation,
        });
        exportOk = true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!isDuplicateExportError(msg)) throw e;
        skipped += 1;
      }
      await upsertExecutedWorkoutFromKaroo({ athleteId: input.athleteId, activityId: id, day, startIso, rec });
      if (exportOk) inserted += 1;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return { inserted, skipped, errors };
}

export async function runKarooPullCronBatch(limit: number): Promise<{
  processed: number;
  completed: number;
  failed: number;
  errors: string[];
  inserted: number;
  skipped: number;
}> {
  if (!readOptionalServiceRoleKey()) throw new Error("SUPABASE_SERVICE_ROLE_KEY richiesta per cron Karoo.");
  const supabase = createServerSupabaseClient();
  const cap = Math.min(25, Math.max(1, Math.floor(limit)));
  const { data: rows, error } = await supabase
    .from("vendor_oauth_links")
    .select("athlete_id, oauth_access_token, oauth_refresh_token")
    .eq("vendor", "hammerhead")
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
      const result = await runKarooPullForAthlete({ athleteId });
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
