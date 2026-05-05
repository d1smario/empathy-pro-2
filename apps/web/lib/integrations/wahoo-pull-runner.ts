import "server-only";

import type { ObservationIngestTags } from "@/lib/empathy/schemas";
import { observationDomainsFromWahooWorkoutPayload } from "@/lib/integrations/wahoo-observation-from-payload";
import { ensureWahooAccessToken } from "@/lib/integrations/wahoo-access-token";
import { wahooApiBaseUrl } from "@/lib/integrations/wahoo-oauth2-api";
import { persistRealityDeviceExport } from "@/lib/reality/provider-adapters";
import { defaultObservationIngestTags } from "@/lib/reality/observation-ingest-defaults";
import { mergeObservationIngestTags } from "@/lib/reality/observation-merge";
import { buildExecutedTrainingImportQuality } from "@/lib/reality/training-import-quality";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getMergedIngestStreams } from "@/lib/integrations/ingest-stream-policy";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function extractWahooWorkouts(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  const o = asRecord(body);
  if (!o) return [];
  const w = o.workouts;
  if (Array.isArray(w)) return w as Record<string, unknown>[];
  const d = o.data;
  if (Array.isArray(d)) return d as Record<string, unknown>[];
  return [];
}

export async function fetchWahooWorkoutsPage(input: {
  accessToken: string;
  startedAfterIso?: string;
  perPage: number;
}): Promise<Record<string, unknown>[]> {
  const u = new URL(`${wahooApiBaseUrl()}/v1/workouts`);
  u.searchParams.set("per_page", String(Math.min(50, Math.max(1, input.perPage))));
  if (input.startedAfterIso) u.searchParams.set("started_after", input.startedAfterIso);

  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${input.accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`wahoo_workouts_parse:${res.status}:${text.slice(0, 400)}`);
  }
  if (!res.ok) {
    throw new Error(`wahoo_workouts_http_${res.status}:${text.slice(0, 600)}`);
  }
  return extractWahooWorkouts(json);
}

function wahooWorkoutExternalId(rec: Record<string, unknown>): string | null {
  if (typeof rec.id === "number" && Number.isFinite(rec.id)) return `wahoo:${Math.trunc(rec.id)}`;
  if (typeof rec.id === "string" && rec.id.trim()) return `wahoo:${rec.id.trim()}`;
  return null;
}

function calendarDayFromWahooWorkout(rec: Record<string, unknown>): string | null {
  const s = rec.starts;
  if (typeof s === "string" && s.length >= 10) return s.slice(0, 10);
  const w = rec.workout_summary;
  const sum = asRecord(w);
  const st = sum?.start_time;
  if (typeof st === "string" && st.length >= 10) return st.slice(0, 10);
  return null;
}

function isDuplicateExportError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("duplicate") || m.includes("23505") || m.includes("unique") || m.includes("uq_device_sync_exports");
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function wahooChannelCoverage(rec: Record<string, unknown>): Record<string, number> {
  const summary = asRecord(rec.workout_summary);
  const merged: Record<string, unknown> = { ...rec, ...(summary ?? {}) };
  const hasHr = num(merged.avg_hr) != null || num(merged.average_heart_rate) != null || num(merged.max_hr) != null;
  const hasPower = num(merged.avg_power) != null || num(merged.average_power) != null || num(merged.max_power) != null;
  const hasSpeed = num(merged.avg_speed) != null || num(merged.speed_avg_kmh) != null || num(merged.distance) != null;
  const hasCadence = num(merged.avg_cadence) != null || num(merged.average_cadence) != null;
  const hasAltitude = num(merged.elevation_gain) != null || num(merged.total_ascent) != null;
  const hasTemperature = num(merged.avg_temperature) != null || num(merged.temperature_avg_c) != null;
  return {
    power: hasPower ? 100 : 0,
    hr: hasHr ? 100 : 0,
    speed: hasSpeed ? 100 : 0,
    cadence: hasCadence ? 100 : 0,
    altitude: hasAltitude ? 100 : 0,
    temperature: hasTemperature ? 100 : 0,
  };
}

async function upsertExecutedWorkoutFromWahooWorkout(input: {
  athleteId: string;
  extId: string;
  day: string | null;
  rec: Record<string, unknown>;
}): Promise<void> {
  const date = input.day;
  if (!date) return;
  const summary = asRecord(input.rec.workout_summary);
  const merged: Record<string, unknown> = { ...input.rec, ...(summary ?? {}) };
  const durationSec = num(merged.duration) ?? num(merged.duration_seconds);
  const durationMinutes = durationSec != null && durationSec > 0 ? Math.max(1, Math.round(durationSec / 60)) : 0;
  if (durationMinutes <= 0) return;
  const tss = Math.max(0, num(merged.training_stress_score) ?? num(merged.tss) ?? 0);
  const kcal = num(merged.calories) ?? null;
  const kj = kcal != null && kcal > 0 ? Math.round(kcal * 4.184 * 100) / 100 : num(merged.work_kj) ?? null;
  const channelCoverage = wahooChannelCoverage(input.rec);
  const quality = buildExecutedTrainingImportQuality({ channelCoverage });
  const source = "api_sync:wahoo:workouts";
  const traceSummary = {
    parser_engine: "wahoo_cloud_v1_workouts",
    parser_version: "1",
    source,
    wahoo_workout_id: input.rec.id ?? null,
    workout_type: input.rec.workout_type ?? null,
    avg_power: num(merged.avg_power) ?? num(merged.average_power),
    avg_hr: num(merged.avg_hr) ?? num(merged.average_heart_rate),
    avg_cadence: num(merged.avg_cadence) ?? num(merged.average_cadence),
    distance_m: num(merged.distance),
    elevation_gain_m: num(merged.elevation_gain) ?? num(merged.total_ascent),
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
  const payload = {
    athlete_id: input.athleteId,
    date,
    duration_minutes: durationMinutes,
    tss,
    kcal,
    kj,
    source,
    external_id: input.extId,
    trace_summary: traceSummary,
    subjective_notes: null as string | null,
  };
  const supabase = createServerSupabaseClient();
  const existing = await supabase
    .from("executed_workouts")
    .select("id")
    .eq("athlete_id", input.athleteId)
    .eq("external_id", input.extId)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    const upd = await supabase.from("executed_workouts").update(payload).eq("id", existing.data.id);
    if (upd.error) throw new Error(upd.error.message);
    return;
  }
  const ins = await supabase.from("executed_workouts").insert(payload);
  if (ins.error) throw new Error(ins.error.message);
}

/**
 * Pull Wahoo Cloud (`/v1/workouts`) → `device_sync_exports`.
 */
export async function runWahooPullForAthlete(input: {
  athleteId: string;
  perPage?: number;
}): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0;
  let skipped = 0;

  const policy = await getMergedIngestStreams(input.athleteId, "wahoo");
  if (!policy.wahoo_workout) {
    return { inserted: 0, skipped: 0, errors };
  }

  const access = await ensureWahooAccessToken(input.athleteId);
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 14);
  const perPage = Math.min(50, Math.max(1, Math.floor(input.perPage ?? 25)));

  const records = await fetchWahooWorkoutsPage({
    accessToken: access,
    startedAfterIso: start.toISOString(),
    perPage,
  });

  for (const rec of records) {
    const extId = wahooWorkoutExternalId(rec);
    if (!extId) continue;

    const base = defaultObservationIngestTags({
      provider: "wahoo",
      domain: "training",
      sourceKind: "api_sync",
      channelCoverage: null,
    });
    const doms = observationDomainsFromWahooWorkoutPayload(rec);
    const fallback: ObservationIngestTags = {
      domains: doms.length > 0 ? doms : ["exertion_mechanical_output", "exertion_physiological_load"],
      modalities: ["session_aggregate"],
      contextRefs: null,
    };
    let observation = base != null ? mergeObservationIngestTags(base, { domains: doms }) : fallback;
    const day = calendarDayFromWahooWorkout(rec);
    if (day) {
      observation = mergeObservationIngestTags(observation, {
        contextRefs: [{ kind: "calendar_day", date: day }],
      });
    }

    try {
      await persistRealityDeviceExport({
        athleteId: input.athleteId,
        provider: "wahoo",
        domain: "training",
        sourceKind: "api_sync",
        externalRef: extId,
        payload: { wahoo_workout: rec },
        canonicalPreview: {
          wahoo_workout_id: rec.id ?? null,
          name: rec.name ?? rec.workout_type ?? null,
        },
        status: "created",
        parserEngine: "wahoo_cloud_v1",
        parserVersion: "1",
        observation,
      });
      await upsertExecutedWorkoutFromWahooWorkout({
        athleteId: input.athleteId,
        extId,
        day,
        rec,
      });
      inserted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isDuplicateExportError(msg)) {
        skipped += 1;
        continue;
      }
      errors.push(msg);
    }
  }

  return { inserted, skipped, errors };
}
