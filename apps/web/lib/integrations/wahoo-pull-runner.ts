import "server-only";

import type { ObservationIngestTags } from "@/lib/empathy/schemas";
import { observationDomainsFromWahooWorkoutPayload } from "@/lib/integrations/wahoo-observation-from-payload";
import { ensureWahooAccessToken } from "@/lib/integrations/wahoo-access-token";
import { wahooApiBaseUrl } from "@/lib/integrations/wahoo-oauth2-api";
import { persistRealityDeviceExport } from "@/lib/reality/provider-adapters";
import { defaultObservationIngestTags } from "@/lib/reality/observation-ingest-defaults";
import { mergeObservationIngestTags } from "@/lib/reality/observation-merge";
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
