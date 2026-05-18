import type { ObservationIngestTags } from "@/lib/empathy/schemas";
import { createNodeSupabaseServicePreferred } from "@/lib/supabase-node-client";
import { shouldMaterializeGarminActivities } from "@/lib/integrations/garmin-health-api-notification-schema";
import { observationDomainsFromGarminActivitySummary } from "@/lib/integrations/garmin-observation-from-summary";
import { defaultObservationIngestTags } from "@/lib/reality/observation-ingest-defaults";
import { mergeObservationIngestTags } from "@/lib/reality/observation-merge";
import { buildExecutedTrainingImportQuality } from "@/lib/reality/training-import-quality";
import { persistExecutedWorkoutSeriesFromTrace } from "@/lib/training/import-series-persist";
import { pickGarminActivityStableId } from "@/lib/integrations/garmin-activity-stable-id";
import { upsertExecutedWorkoutByExternalId } from "@/lib/training/executed/upsert-executed-workout";
import { resolveGarminActivitySessionTimes } from "@/lib/training/executed/executed-workout-session-times";
import { inferEmpathyTrainingLoadForSession } from "@empathy/domain-training";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Giorno **ISO calendario (UTC)** dell’attività per indici Empathy (`executed_workouts.date`).
 * Garmin espone `startTimeInSeconds` come epoch **UTC**; `toISOString().slice(0,10)` è quindi il giorno UTC,
 * non necessariamente il “giorno locale” mostrato da Garmin Connect in fuso atleta (es. sera in Italia → può cadere sul giorno gregoriano UTC successivo).
 */
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

/** Per follow-up pull (`activityFile` / `activityDetails`) dopo `activities` — stessa euristica del materializer. */
export function listGarminActivitySummariesFromWellnessBody(body: unknown): Record<string, unknown>[] {
  const sink: Record<string, unknown>[] = [];
  collectActivityRecords(body, sink);
  return sink;
}

/** Soglia legacy: molti summary Garmin sparano molti `samples` HR-only senza GPS → non bastava `length`. */
const GARMIN_RICH_SAMPLE_COUNT = 24;

function countGpsPointsInGarminSamples(samples: unknown): number {
  if (!Array.isArray(samples)) return 0;
  let n = 0;
  for (const raw of samples) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const s = raw as Record<string, unknown>;
    const lat = s.latitudeInDegree;
    const lon = s.longitudeInDegree;
    if (
      typeof lat === "number" &&
      Number.isFinite(lat) &&
      Math.abs(lat) <= 90 &&
      typeof lon === "number" &&
      Number.isFinite(lon) &&
      Math.abs(lon) <= 180 &&
      !(lat === 0 && lon === 0)
    ) {
      n += 1;
    }
  }
  return n;
}

/** Punti GPS **distinti** (arrotondati): due campioni sullo stesso punto non costituiscono una polyline. */
function countDistinctGpsPointsInGarminSamples(samples: unknown): number {
  if (!Array.isArray(samples)) return 0;
  const seen = new Set<string>();
  for (const raw of samples) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const s = raw as Record<string, unknown>;
    const lat = s.latitudeInDegree;
    const lon = s.longitudeInDegree;
    if (
      typeof lat === "number" &&
      Number.isFinite(lat) &&
      Math.abs(lat) <= 90 &&
      typeof lon === "number" &&
      Number.isFinite(lon) &&
      Math.abs(lon) <= 180 &&
      !(lat === 0 && lon === 0)
    ) {
      seen.add(`${lat.toFixed(5)},${lon.toFixed(5)}`);
    }
  }
  return seen.size;
}

/**
 * Dopo GET `activities`, serve accodare `activityDetails` / `activityFile`?
 * Prima: solo `samples.length < 24` → attività con ≥24 campioni **solo HR** non scaricavano mai FIT/GPX (traccia assente in UI).
 * Ora: anche con molti campioni, se ci sono **meno di 2** punti GPS **distinti** nei `samples`, restiamo “poveri” di percorso e chiediamo il file.
 */
export function garminActivitySummaryNeedsBinaryFollowUp(r: Record<string, unknown>): boolean {
  const samples = r.samples;
  if (!Array.isArray(samples) || samples.length < GARMIN_RICH_SAMPLE_COUNT) return true;
  if (countGpsPointsInGarminSamples(samples) < 2) return true;
  return countDistinctGpsPointsInGarminSamples(samples) < 2;
}

/**
 * Se il summary espone già medie canoniche (anche senza `samples[]`), la copertura qualità
 * non deve restare a zero: altrimenti l’UI segnala “tutto mancante” pur avendo FC/distanza ok.
 */
function bumpChannelCoverageFromGarminCanonical(
  cov: Record<string, number>,
  canonical: Record<string, number | null>,
): void {
  if (canonical.hr_avg_bpm != null) cov.hr = Math.max(cov.hr, 100);
  if (canonical.power_avg_w != null) cov.power = Math.max(cov.power, 100);
  if (canonical.speed_avg_kmh != null) cov.speed = Math.max(cov.speed, 100);
  if (canonical.cadence_avg_rpm != null) cov.cadence = Math.max(cov.cadence, 100);
  if (canonical.elevation_gain_m != null) cov.altitude = Math.max(cov.altitude, 100);
  if (canonical.temperature_avg_c != null) cov.temperature = Math.max(cov.temperature, 100);
}

/** Copertura canali da summary Garmin (nessuno stream intero: spesso parziale vs file). */
function garminActivityChannelCoverage(r: Record<string, unknown>): Record<string, number> {
  const hr =
    typeof r.averageHeartRateInBeatsPerMinute === "number" ||
    typeof r.averageHeartRate === "number" ||
    typeof r.avgHeartRate === "number" ||
    typeof r.averageHR === "number" ||
    typeof r.meanHeartRate === "number" ||
    typeof r.maxHeartRateInBeatsPerMinute === "number" ||
    typeof r.maxHeartRate === "number";
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
  const stable = pickGarminActivityStableId(r);
  if (stable) return `garmin_api:${stable}`;
  const t = activityDateString(r) ?? "unknown";
  const d = durationSeconds(r) ?? 0;
  return `garmin_api:hash:${t}:${Math.trunc(d)}:${String(r.activityType ?? "act")}`;
}

function pickNumber(r: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * Rimap medie/min/max dal summary Garmin in chiavi canoniche `trace_summary`,
 * coerenti con `apps/web/lib/training/import-normalizer.ts`. Niente serie HD: il
 * summary non le espone, eventuali curve dense restano dipendenti dal file FIT.
 */
function buildGarminCanonicalSummary(r: Record<string, unknown>): Record<string, number | null> {
  const distanceMeters = pickNumber(r, ["distanceInMeters", "distance"]);
  const distanceKm = distanceMeters != null ? distanceMeters / 1000 : null;

  const speedAvgMs = pickNumber(r, ["averageSpeedInMetersPerSecond", "averageSpeed"]);
  const speedMaxMs = pickNumber(r, ["maxSpeedInMetersPerSecond", "maxSpeed"]);

  return {
    distance_km: distanceKm,
    power_avg_w: pickNumber(r, ["averagePower", "avgPower"]),
    power_max_w: pickNumber(r, ["maxPower"]),
    hr_avg_bpm: pickNumber(r, [
      "averageHeartRateInBeatsPerMinute",
      "averageHeartRate",
      "avgHeartRate",
      "averageHR",
      "meanHeartRate",
    ]),
    hr_max_bpm: pickNumber(r, ["maxHeartRateInBeatsPerMinute", "maxHeartRate"]),
    cadence_avg_rpm: pickNumber(r, [
      "averageBikeCadenceInRoundsPerMinute",
      "averageRunCadenceInStepsPerMinute",
      "averageSwimCadenceInStrokesPerMinute",
    ]),
    cadence_max_rpm: pickNumber(r, [
      "maxBikeCadenceInRoundsPerMinute",
      "maxRunCadenceInStepsPerMinute",
      "maxSwimCadenceInStrokesPerMinute",
    ]),
    speed_avg_kmh: speedAvgMs != null ? speedAvgMs * 3.6 : null,
    speed_max_kmh: speedMaxMs != null ? speedMaxMs * 3.6 : null,
    elevation_gain_m: pickNumber(r, [
      "totalElevationGainInMeters",
      "elevationGainInMeters",
      "totalAscentInMeters",
    ]),
    temperature_avg_c: pickNumber(r, ["averageTemperatureInCelsius"]),
  };
}

/**
 * Estrazione serie HD da `samples[]` Garmin Activity Details API.
 * Schema: vedi https://developer.garmin.com/wellness-api/.
 * Restituisce le chiavi canoniche `*_series_*` compatibili con
 * `persistExecutedWorkoutSeriesFromTrace` + `series-channel-registry`.
 *
 * Canali popolati quando i samples li espongono:
 *   - power_series_w, hr_series_bpm, speed_series_kmh, cadence_series_rpm
 *   - altitude_series_m, temperature_series_c
 *   - route_series_geo (oggetti `{lat, lon, alt?}`)
 *   - distance_series_m (cumulato in metri)
 *   - time_series_s (secondi dallo start)
 *   - pace_series_min_per_km (derivato da speed quando ≥ ~0.3 m/s, evita /0 da fermo)
 *   - vertical_speed_series_mps (derivato altitude/Δt)
 */
type GarminGeoSample = { lat: number; lon: number; alt?: number };

function extractGarminActivitySeries(samples: unknown): Record<string, unknown> {
  if (!Array.isArray(samples) || samples.length < 1) return {};
  const power: number[] = [];
  const hr: number[] = [];
  const speedKmh: number[] = [];
  const speedMs: number[] = [];
  const cadence: number[] = [];
  const altitude: number[] = [];
  const tempC: number[] = [];
  const route: GarminGeoSample[] = [];
  const distanceM: number[] = [];
  const timeS: number[] = [];

  let startSec: number | null = null;
  for (const raw of samples) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const sStart = (raw as Record<string, unknown>).startTimeInSeconds;
    if (typeof sStart === "number" && Number.isFinite(sStart)) {
      startSec = sStart;
      break;
    }
  }

  for (const raw of samples) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const s = raw as Record<string, unknown>;

    const p = s.powerInWatts;
    if (typeof p === "number" && Number.isFinite(p)) power.push(p);

    const h = s.heartRate ?? s.heartRateInBeatsPerMinute ?? s.averageHeartRateInBeatsPerMinute;
    if (typeof h === "number" && Number.isFinite(h)) hr.push(h);

    const v = s.speedMetersPerSecond;
    if (typeof v === "number" && Number.isFinite(v)) {
      speedMs.push(v);
      speedKmh.push(v * 3.6);
    }

    const cBike = s.bikeCadenceInRPM;
    const cRun = s.stepsPerMinute;
    const cSwim = s.swimCadenceInStrokesPerMinute;
    const c =
      typeof cBike === "number" && Number.isFinite(cBike)
        ? cBike
        : typeof cRun === "number" && Number.isFinite(cRun)
          ? cRun
          : typeof cSwim === "number" && Number.isFinite(cSwim)
            ? cSwim
            : null;
    if (c != null) cadence.push(c);

    const e = s.elevationInMeters;
    if (typeof e === "number" && Number.isFinite(e)) altitude.push(e);

    const t = s.airTemperatureCelcius;
    if (typeof t === "number" && Number.isFinite(t)) tempC.push(t);

    const lat = s.latitudeInDegree;
    const lon = s.longitudeInDegree;
    if (
      typeof lat === "number" &&
      Number.isFinite(lat) &&
      Math.abs(lat) <= 90 &&
      typeof lon === "number" &&
      Number.isFinite(lon) &&
      Math.abs(lon) <= 180
    ) {
      const geo: GarminGeoSample = { lat, lon };
      if (typeof e === "number" && Number.isFinite(e)) geo.alt = e;
      route.push(geo);
    }

    const dist = s.totalDistanceInMeters;
    if (typeof dist === "number" && Number.isFinite(dist) && dist >= 0) distanceM.push(dist);

    const sStart = s.startTimeInSeconds;
    if (typeof sStart === "number" && Number.isFinite(sStart) && startSec != null) {
      timeS.push(Math.max(0, sStart - startSec));
    }
  }

  /** Pace istantaneo (min/km) derivato da speed; evitiamo divisione per zero quando fermo. */
  const paceMinPerKm: number[] = [];
  if (speedMs.length >= 1) {
    for (const v of speedMs) {
      if (v >= 0.3) paceMinPerKm.push(1000 / v / 60);
    }
  }

  /** Velocità verticale m/s derivata da altitude e time_s; richiede entrambe stessa lunghezza. */
  const verticalMps: number[] = [];
  if (altitude.length >= 2 && altitude.length === timeS.length) {
    for (let i = 1; i < altitude.length; i += 1) {
      const dh = altitude[i] - altitude[i - 1];
      const dt = timeS[i] - timeS[i - 1];
      if (dt > 0 && Number.isFinite(dh)) verticalMps.push(dh / dt);
    }
  }

  /** Sessioni brevi (es. camminata 2–5 min): anche 1 campione/canale alimenta grafico + persistenza. */
  const out: Record<string, unknown> = {};
  if (power.length >= 1) out.power_series_w = power;
  if (hr.length >= 1) out.hr_series_bpm = hr;
  if (speedKmh.length >= 1) out.speed_series_kmh = speedKmh;
  if (cadence.length >= 1) out.cadence_series_rpm = cadence;
  if (altitude.length >= 1) out.altitude_series_m = altitude;
  if (tempC.length >= 1) out.temperature_series_c = tempC;
  if (route.length >= 1) out.route_series_geo = route;
  if (distanceM.length >= 1) out.distance_series_m = distanceM;
  if (timeS.length >= 1) out.time_series_s = timeS;
  if (paceMinPerKm.length >= 1) out.pace_series_min_per_km = paceMinPerKm;
  if (verticalMps.length >= 1) out.vertical_speed_series_mps = verticalMps;
  return out;
}

function inferGarminTrainingLoad(r: Record<string, unknown>, durationMinutes: number): number {
  const summary = buildGarminCanonicalSummary(r);
  const direct = r.trainingLoadScore ?? r.trainingStressScore ?? r.tss;
  let vendorLoad: number | null = null;
  if (typeof direct === "number" && Number.isFinite(direct) && direct > 0) {
    vendorLoad = direct;
  } else {
    const te = asRecord(r.trainingEffect);
    const v = te?.lte ?? te?.aerobicTrainingEffect;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) vendorLoad = Math.min(999, v * 20);
  }
  return inferEmpathyTrainingLoadForSession({
    vendorLoad,
    avgPowerW: summary.power_avg_w,
    ftpW: null,
    hrAvgBpm: summary.hr_avg_bpm,
    durationMinutes,
  });
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

  const supabase = createNodeSupabaseServicePreferred();
  let upserted = 0;

  for (const r of sink) {
    const date = activityDateString(r);
    const durSec = durationSeconds(r);
    if (!date || durSec == null) continue;

    const durationMinutes = Math.max(1, Math.round(durSec / 60));
    const tss = inferGarminTrainingLoad(r, durationMinutes);
    const kcalRaw = r.activeKilocalories ?? r.calories;
    const kcal = typeof kcalRaw === "number" && Number.isFinite(kcalRaw) ? kcalRaw : null;
    const kj = kcal != null ? Math.round(kcal * 4.184 * 1000) / 1000 : null;
    const externalId = pickExternalId(r);
    const activityType = String(r.activityType ?? r.activityName ?? r.moveIQActivityType ?? "garmin");

    const observation = buildGarminObservationForRow(r, date, null);

    const samplesSeries = extractGarminActivitySeries(r.samples);
    const hasSamples = Object.keys(samplesSeries).length > 0;

    /**
     * Fallback: il push `activities` (summary) non porta `samples[]` ma può avere
     * `startingLatitudeInDegree` / `startingLongitudeInDegree`. Lo salviamo come
     * `route_series_geo` con due punti coincidenti (marker singolo) — la UI mappa
     * lo riconoscerà come "punto di partenza" e disegnerà un marker invece di una
     * polyline. Quando arriverà l'`activityDetails` corrispondente, il materializer
     * sovrascriverà con la polyline completa via upsert (`onConflict` channel/version).
     */
    if (!samplesSeries.route_series_geo) {
      const startLat = (r as Record<string, unknown>).startingLatitudeInDegree;
      const startLon = (r as Record<string, unknown>).startingLongitudeInDegree;
      if (
        typeof startLat === "number" &&
        Number.isFinite(startLat) &&
        Math.abs(startLat) <= 90 &&
        typeof startLon === "number" &&
        Number.isFinite(startLon) &&
        Math.abs(startLon) <= 180 &&
        !(startLat === 0 && startLon === 0)
      ) {
        const marker = { lat: startLat, lon: startLon };
        samplesSeries.route_series_geo = [marker, marker];
      }
    }

    const hasPersistableSeries = Object.keys(samplesSeries).length > 0;

    const canonical = buildGarminCanonicalSummary(r);
    const channelCoverage = garminActivityChannelCoverage(r);
    bumpChannelCoverageFromGarminCanonical(channelCoverage, canonical);
    if (hasSamples) {
      if (samplesSeries.power_series_w) channelCoverage.power = 100;
      if (samplesSeries.hr_series_bpm) channelCoverage.hr = 100;
      if (samplesSeries.speed_series_kmh) channelCoverage.speed = 100;
      if (samplesSeries.cadence_series_rpm) channelCoverage.cadence = 100;
      if (samplesSeries.altitude_series_m) channelCoverage.altitude = 100;
      if (samplesSeries.temperature_series_c) channelCoverage.temperature = 100;
    }
    const quality = buildExecutedTrainingImportQuality({ channelCoverage });

    const traceSummary = {
      parser_engine: hasSamples
        ? "garmin_wellness_api_activity_details"
        : "garmin_wellness_api_summary",
      parser_version: "2",
      activity_type: activityType,
      summary_id: r.summaryId ?? null,
      activity_id: r.activityId ?? null,
      source: "api_sync:garmin:activities",
      ...canonical,
      ...samplesSeries,
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

    const sessionTimes = resolveGarminActivitySessionTimes(r);
    const payload = {
      athlete_id: input.athleteId,
      date,
      ...(sessionTimes ? { started_at: sessionTimes.started_at, ended_at: sessionTimes.ended_at } : {}),
      duration_minutes: durationMinutes,
      tss,
      kj,
      kcal,
      trace_summary: traceSummary,
      subjective_notes: null as string | null,
      source: "api_sync:garmin:activities",
      external_id: externalId,
    };

    let executedWorkoutId: string | null = null;
    let traceFinal: Record<string, unknown> | null = null;
    try {
      const upsert = await upsertExecutedWorkoutByExternalId(supabase, payload);
      executedWorkoutId = upsert.id;
      if (executedWorkoutId) {
        const obsWithId = buildGarminObservationForRow(r, date, executedWorkoutId);
        traceFinal = { ...traceSummary, observation: obsWithId };
        const patch = await supabase
          .from("executed_workouts")
          .update({ trace_summary: traceFinal })
          .eq("id", executedWorkoutId);
        if (!patch.error) {
          upserted += 1;
        }
      }
    } catch {
      continue;
    }

    /** Fase 3 device → UI: persistenza HD su `executed_workout_series` quando samples[] o marker GPS presenti. */
    if (hasPersistableSeries && executedWorkoutId && traceFinal) {
      try {
        await persistExecutedWorkoutSeriesFromTrace({
          db: supabase,
          athleteId: input.athleteId,
          executedWorkoutId,
          traceSummary: traceFinal,
          parserEngine: traceFinal.parser_engine as string,
          parserVersion: traceFinal.parser_version as string,
          source: "api_sync:garmin:activities",
        });
      } catch {
        // best-effort: non bloccare l'ingest se la tabella manca o RLS blocca.
      }
    }
  }

  return { upserted };
}
