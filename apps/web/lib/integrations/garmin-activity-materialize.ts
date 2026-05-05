import "server-only";

import type { ObservationIngestTags } from "@/lib/empathy/schemas";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { shouldMaterializeGarminActivities } from "@/lib/integrations/garmin-health-api-notification-schema";
import { observationDomainsFromGarminActivitySummary } from "@/lib/integrations/garmin-observation-from-summary";
import { defaultObservationIngestTags } from "@/lib/reality/observation-ingest-defaults";
import { mergeObservationIngestTags } from "@/lib/reality/observation-merge";
import { buildExecutedTrainingImportQuality } from "@/lib/reality/training-import-quality";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function activityDateString(r: Record<string, unknown>): string | null {
  const sec = r.startTimeInSeconds;
  if (typeof sec === "number" && Number.isFinite(sec)) {
    return new Date(Math.trunc(sec) * 1000).toISOString().slice(0, 10);
  }
  const gmt = r.startTimeGMT;
  if (typeof gmt === "string" && gmt.length >= 8) {
    const d = new Date(gmt);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function durationSeconds(r: Record<string, unknown>): number | null {
  const d = r.durationInSeconds ?? r.duration;
  if (typeof d === "number" && Number.isFinite(d) && d > 0) return d;
  return null;
}

function looksLikeActivitySummary(r: Record<string, unknown>): boolean {
  const dur = durationSeconds(r);
  if (dur == null) return false;
  const date = activityDateString(r);
  if (!date) return false;
  return Boolean(
    r.activityType ??
      r.activityId ??
      r.summaryId ??
      r.activityName ??
      r.activitySubType ??
      r.moveIQActivityType,
  );
}

function collectActivityRecords(node: unknown, sink: Record<string, unknown>[]): void {
  const rec = asRecord(node);
  if (!rec) {
    if (Array.isArray(node)) {
      for (const x of node) collectActivityRecords(x, sink);
    }
    return;
  }
  if (looksLikeActivitySummary(rec)) sink.push(rec);
  for (const v of Object.values(rec)) {
    if (v && typeof v === "object") collectActivityRecords(v, sink);
  }
}

/** Copertura canali da summary Garmin (nessuno stream intero: spesso parziale vs file). */
function garminActivityChannelCoverage(r: Record<string, unknown>): Record<string, number> {
  const hr =
    typeof r.averageHeartRateInBeatsPerMinute === "number" ||
    typeof r.averageHeartRate === "number" ||
    typeof r.maxHeartRateInBeatsPerMinute === "number";
  const power = typeof r.averagePower === "number" || typeof r.maxPower === "number";
  const speed =
    typeof r.averageSpeedInMetersPerSecond === "number" ||
    typeof r.maxSpeedInMetersPerSecond === "number";
  const cadence =
    typeof r.averageRunCadenceInStepsPerMinute === "number" ||
    typeof r.averageBikeCadenceInRoundsPerMinute === "number";
  const altitude =
    typeof r.totalElevationGainInMeters === "number" || typeof r.elevationGainInMeters === "number";
  const temperature = typeof r.averageTemperatureInCelsius === "number";
  return {
    power: power ? 100 : 0,
    hr: hr ? 100 : 0,
    speed: speed ? 100 : 0,
    cadence: cadence ? 100 : 0,
    altitude: altitude ? 100 : 0,
    temperature: temperature ? 100 : 0,
  };
}

function pickExternalId(r: Record<string, unknown>): string {
  const sid = r.summaryId ?? r.activityId;
  if (typeof sid === "string" && sid.trim()) return `garmin_api:${sid.trim()}`;
  if (typeof sid === "number" && Number.isFinite(sid)) return `garmin_api:${String(Math.trunc(sid))}`;
  const t = activityDateString(r) ?? "unknown";
  const d = durationSeconds(r) ?? 0;
  return `garmin_api:hash:${t}:${Math.trunc(d)}:${String(r.activityType ?? "act")}`;
}

function inferTss(r: Record<string, unknown>): number {
  const direct = r.trainingLoadScore ?? r.trainingStressScore ?? r.tss;
  if (typeof direct === "number" && Number.isFinite(direct) && direct >= 0) return direct;
  const te = asRecord(r.trainingEffect);
  const v = te?.lte ?? te?.aerobicTrainingEffect;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.min(999, v * 20);
  return 0;
}

function buildGarminObservationForRow(
  r: Record<string, unknown>,
  date: string,
  executedWorkoutId: string | null,
): ObservationIngestTags {
  const base =
    defaultObservationIngestTags({
      provider: "garmin",
      domain: "training",
      sourceKind: "api_sync",
      channelCoverage: null,
    }) ?? {
      domains: ["exertion_mechanical_output", "exertion_physiological_load", "positioning_navigation"],
      modalities: ["daily_aggregate"],
      contextRefs: null,
    };

  const fromKeys = observationDomainsFromGarminActivitySummary(r);
  let merged = mergeObservationIngestTags(base, { domains: fromKeys });
  merged = mergeObservationIngestTags(merged, {
    contextRefs: [{ kind: "calendar_day", date }],
  });
  if (executedWorkoutId) {
    merged = mergeObservationIngestTags(merged, {
      contextRefs: [{ kind: "executed_workout", executedWorkoutId }],
    });
  }
  return merged;
}

/**
 * Dopo pull HTTP 200 su stream activities (o JSON compatibile), inserisce/aggiorna `executed_workouts`.
 */
export async function materializeGarminActivitiesFromPullResponse(input: {
  athleteId: string;
  endpointKind: string;
  /** Da `garmin_pull_jobs.stream_key` (es. `activities`); l’URL webhook è spesso `ping`. */
  streamKey?: string | null;
  responseBody: unknown;
}): Promise<{ upserted: number }> {
  if (
    !shouldMaterializeGarminActivities({
      streamKey: input.streamKey,
      endpointKind: input.endpointKind,
      responseBody: input.responseBody,
    })
  ) {
    return { upserted: 0 };
  }

  const sink: Record<string, unknown>[] = [];
  collectActivityRecords(input.responseBody, sink);
  if (sink.length === 0) return { upserted: 0 };

  const supabase = createServerSupabaseClient();
  let upserted = 0;

  for (const r of sink) {
    const date = activityDateString(r);
    const durSec = durationSeconds(r);
    if (!date || durSec == null) continue;

    const durationMinutes = Math.max(1, Math.round(durSec / 60));
    const tss = inferTss(r);
    const kcalRaw = r.activeKilocalories ?? r.calories;
    const kcal = typeof kcalRaw === "number" && Number.isFinite(kcalRaw) ? kcalRaw : null;
    const kj = kcal != null ? Math.round(kcal * 4.184 * 1000) / 1000 : null;
    const externalId = pickExternalId(r);
    const activityType = String(r.activityType ?? r.activityName ?? r.moveIQActivityType ?? "garmin");

    const observation = buildGarminObservationForRow(r, date, null);

    const channelCoverage = garminActivityChannelCoverage(r);
    const quality = buildExecutedTrainingImportQuality({ channelCoverage });

    const traceSummary = {
      parser_engine: "garmin_wellness_api_summary",
      parser_version: "1",
      activity_type: activityType,
      summary_id: r.summaryId ?? null,
      activity_id: r.activityId ?? null,
      source: "api_sync:garmin:activities",
      garmin_keys: Object.keys(r).slice(0, 40),
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
      observation,
    };

    const payload = {
      athlete_id: input.athleteId,
      date,
      duration_minutes: durationMinutes,
      tss,
      kj,
      kcal,
      trace_summary: traceSummary,
      subjective_notes: null as string | null,
      source: "api_sync:garmin:activities",
      external_id: externalId,
    };

    const existing = await supabase
      .from("executed_workouts")
      .select("id")
      .eq("athlete_id", input.athleteId)
      .eq("external_id", externalId)
      .limit(1)
      .maybeSingle();

    if (existing.error) continue;

    if (existing.data?.id) {
      const obsWithId = buildGarminObservationForRow(r, date, existing.data.id);
      const up = await supabase
        .from("executed_workouts")
        .update({
          ...payload,
          trace_summary: { ...traceSummary, observation: obsWithId },
        })
        .eq("id", existing.data.id);
      if (!up.error) upserted += 1;
    } else {
      const ins = await supabase.from("executed_workouts").insert(payload).select("id").maybeSingle();
      if (!ins.error && ins.data?.id) {
        const obsWithId = buildGarminObservationForRow(r, date, ins.data.id);
        const traceFinal = { ...traceSummary, observation: obsWithId };
        const patch = await supabase.from("executed_workouts").update({ trace_summary: traceFinal }).eq("id", ins.data.id);
        if (!patch.error) upserted += 1;
      }
    }
  }

  return { upserted };
}
