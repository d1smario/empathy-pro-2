import "server-only";

import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureFreshGarminAccessTokenForAthlete } from "@/lib/integrations/garmin-access-token";
import { tryParseGarminApiErrorMessage } from "@/lib/integrations/garmin-api-error-body";
import { garminWellnessAbsoluteUrl } from "@/lib/integrations/garmin-wellness-api";
import type { ObservationIngestTags, RealityDomain } from "@/lib/empathy/schemas";
import { defaultObservationIngestTags } from "@/lib/reality/observation-ingest-defaults";
import { mergeObservationIngestTags } from "@/lib/reality/observation-merge";
import { persistRealityDeviceExport } from "@/lib/reality/provider-adapters";

/** Stream GET compatibili (apiDocs Wellness) senza ping: usiamo coppia uploadStart/End. */
export const GARMIN_WELLNESS_SNAPSHOT_PULL_STREAMS = [
  "dailies",
  "sleeps",
  "stressDetails",
  "hrv",
  "pulseOx",
  "respiration",
] as const;

export type GarminWellnessSnapshotStream = (typeof GARMIN_WELLNESS_SNAPSHOT_PULL_STREAMS)[number];

export function garminWellnessSnapshotAllowedKeys(): Set<string> {
  return new Set<string>(GARMIN_WELLNESS_SNAPSHOT_PULL_STREAMS);
}

function streamAllowedSet(): Set<string> {
  return garminWellnessSnapshotAllowedKeys();
}

/** Path REST `/rest/...` — allineamento `garmin-wellness-api.ts` (camelCase). */
export function garminSnapshotRestPath(stream: GarminWellnessSnapshotStream): string {
  const paths: Record<string, string> = {
    dailies: "/rest/dailies",
    sleeps: "/rest/sleeps",
    stressDetails: "/rest/stressDetails",
    hrv: "/rest/hrv",
    pulseOx: "/rest/pulseOx",
    respiration: "/rest/respiration",
  };
  return paths[stream] ?? `/rest/${stream}`;
}

function domainForStream(stream: GarminWellnessSnapshotStream): RealityDomain {
  return stream === "sleeps" ? "sleep" : "health";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Normalizza risposta: array diretto oppure primo array in radice oggetto. */
export function extractGarminWellnessSummaryList(body: unknown, streamHint: string): Record<string, unknown>[] {
  if (Array.isArray(body)) return body.filter((x): x is Record<string, unknown> => asRecord(x) != null);
  const root = asRecord(body);
  if (!root) return [];
  if (Array.isArray(root[streamHint])) {
    const a = root[streamHint] as unknown[];
    return a.filter((x): x is Record<string, unknown> => asRecord(x) != null);
  }
  const lower = streamHint.toLowerCase();
  for (const k of Object.keys(root)) {
    if (k.toLowerCase() !== lower || !Array.isArray(root[k])) continue;
    const a = root[k] as unknown[];
    return a.filter((x): x is Record<string, unknown> => asRecord(x) != null);
  }
  for (const v of Object.values(root)) {
    if (Array.isArray(v)) {
      const a = v.filter((x): x is Record<string, unknown> => asRecord(x) != null);
      if (a.length) return a;
    }
  }
  return [];
}

function calendarHintFromGarminSummaryItem(item: Record<string, unknown>): string | null {
  const iso =
    typeof item.calendarDate === "string"
      ? item.calendarDate.trim()
      : typeof item.calendar_date === "string"
        ? item.calendar_date.trim()
        : typeof item.date === "string"
          ? item.date.trim()
          : null;
  if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
  const sid = typeof item.summaryId === "string" ? item.summaryId.trim() : null;
  if (sid) return sid.slice(0, 32);
  return null;
}

function externalRefForGarminSummaryItem(stream: GarminWellnessSnapshotStream, item: Record<string, unknown>): string {
  const cal = calendarHintFromGarminSummaryItem(item);
  const sid = typeof item.summaryId === "string" ? item.summaryId.trim() : "";
  const act = typeof item.activityId === "number" ? String(Math.trunc(item.activityId)) : "";
  if (sid && cal) return `garmin_${stream}_${cal}_${sid}`.slice(0, 500);
  if (sid) return `garmin_${stream}_${sid}`.slice(0, 500);
  const st = typeof item.startTimeInSeconds === "number" ? String(Math.trunc(item.startTimeInSeconds)) : "";
  const endSt = typeof item.endTimeInSeconds === "number" ? String(Math.trunc(item.endTimeInSeconds)) : "";
  const tail = st || endSt || cryptoRandomSuffix();
  return `garmin_${stream}_${cal ?? "nodate"}_${tail}`.slice(0, 500);
}

function cryptoRandomSuffix(): string {
  return randomBytes(6).toString("hex");
}

function buildObservation(stream: GarminWellnessSnapshotStream, item: Record<string, unknown>): ObservationIngestTags {
  const day = calendarHintFromGarminSummaryItem(item);
  const domain = domainForStream(stream);
  const base = defaultObservationIngestTags({
    provider: "garmin",
    domain,
    sourceKind: "api_sync",
    channelCoverage: null,
  });
  let obs =
    base ??
    ({
      domains: domain === "sleep" ? ["sleep_timing_duration", "sleep_staging_microstructure"] : ["autonomic_recovery_state"],
      modalities: ["epoch_summary"],
      contextRefs: null,
    } satisfies ObservationIngestTags);
  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    obs = mergeObservationIngestTags(obs, {
      contextRefs: [{ kind: "calendar_day", date: day }],
    });
  }
  return obs;
}

function duplicateExportMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("duplicate") || m.includes("23505") || m.includes("unique") || m.includes("uq_device_sync_exports");
}

export async function fetchGarminWellnessSnapshotForStream(params: {
  accessToken: string;
  stream: GarminWellnessSnapshotStream;
  summaryStartTimeInSeconds: number;
  summaryEndTimeInSeconds: number;
}): Promise<{ ok: true; httpStatus: number; items: Record<string, unknown>[] } | { ok: false; httpStatus: number; errorMessage: string }> {
  const start = Math.trunc(params.summaryStartTimeInSeconds);
  const end = Math.trunc(params.summaryEndTimeInSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return { ok: false, httpStatus: 400, errorMessage: "invalid_upload_window" };
  }
  const path = garminSnapshotRestPath(params.stream);
  const u = new URL(garminWellnessAbsoluteUrl(path));
  u.searchParams.set("uploadStartTimeInSeconds", String(start));
  u.searchParams.set("uploadEndTimeInSeconds", String(end));

  const res = await fetch(u.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${params.accessToken.trim()}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      errorMessage: tryParseGarminApiErrorMessage(text) ?? text.slice(0, 900),
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, httpStatus: 502, errorMessage: "invalid_json_snapshot" };
  }
  const items = extractGarminWellnessSummaryList(parsed, params.stream);
  return { ok: true, httpStatus: res.status, items };
}

/** Legge stream da env `GARMIN_WELLNESS_SNAPSHOT_STREAMS` (comma-separated) o default. */
export function readGarminWellnessSnapshotStreamsFromEnv(): GarminWellnessSnapshotStream[] {
  const raw = process.env.GARMIN_WELLNESS_SNAPSHOT_STREAMS?.trim();
  if (!raw) return [...GARMIN_WELLNESS_SNAPSHOT_PULL_STREAMS];
  const set = streamAllowedSet();
  const out: GarminWellnessSnapshotStream[] = [];
  for (const p of raw.split(/[,;\s]+/)) {
    const s = p.trim();
    if (set.has(s)) out.push(s as GarminWellnessSnapshotStream);
  }
  return out.length > 0 ? out : [...GARMIN_WELLNESS_SNAPSHOT_PULL_STREAMS];
}

export type GarminWellnessSnapshotPullResult = {
  stream: string;
  httpStatus: number;
  ok: boolean;
  fetched: number;
  inserted: number;
  skipped: number;
  errorMessage?: string;
};

/**
 * GET summary wellness (no backfill): salva ogni summary in `device_sync_exports` per il merge nel daily panel.
 */
export async function runGarminWellnessSnapshotPull(input: {
  supabase: SupabaseClient;
  athleteId: string;
  /** Default 72h (UTC) per catturare sonno/attraversa mezzanotte. */
  hoursBack?: number;
  streams?: GarminWellnessSnapshotStream[];
}): Promise<{ results: GarminWellnessSnapshotPullResult[]; uploadEnd: number; uploadStart: number }> {
  const tok = await ensureFreshGarminAccessTokenForAthlete(input.supabase, input.athleteId);
  if ("error" in tok) {
    throw new Error(tok.error);
  }
  const end = Math.floor(Date.now() / 1000);
  const hrs = typeof input.hoursBack === "number" && Number.isFinite(input.hoursBack)
    ? Math.min(168, Math.max(6, Math.floor(input.hoursBack)))
    : 72;
  const start = end - hrs * 3600;
  const streams = input.streams?.length ? input.streams : readGarminWellnessSnapshotStreamsFromEnv();

  const results: GarminWellnessSnapshotPullResult[] = [];

  for (let i = 0; i < streams.length; i += 1) {
    const stream = streams[i]!;
    const fr = await fetchGarminWellnessSnapshotForStream({
      accessToken: tok.accessToken,
      stream,
      summaryStartTimeInSeconds: start,
      summaryEndTimeInSeconds: end,
    });

    if (!fr.ok) {
      results.push({
        stream,
        httpStatus: fr.httpStatus,
        ok: false,
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errorMessage: fr.errorMessage.slice(0, 500),
      });
    } else {
      let inserted = 0;
      let skipped = 0;
      for (const item of fr.items) {
        const ext = externalRefForGarminSummaryItem(stream, item);
        try {
          await persistRealityDeviceExport({
            athleteId: input.athleteId,
            provider: "garmin",
            domain: domainForStream(stream),
            sourceKind: "api_sync",
            externalRef: ext,
            payload: {
              ...item,
              garmin_wellness_snapshot_pull: true as const,
              garmin_stream: stream,
              snapshot_upload_window: { uploadStartTimeInSeconds: start, uploadEndTimeInSeconds: end },
            },
            parserEngine: "garmin_wellness_rest_snapshot",
            parserVersion: "1",
            observation: buildObservation(stream, item),
          });
          inserted += 1;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (duplicateExportMessage(msg)) skipped += 1;
          else throw e;
        }
      }
      results.push({
        stream,
        httpStatus: fr.httpStatus,
        ok: true,
        fetched: fr.items.length,
        inserted,
        skipped,
      });
    }

    if (i < streams.length - 1) {
      await new Promise((r) => setTimeout(r, 180));
    }
  }

  return { results, uploadStart: start, uploadEnd: end };
}
