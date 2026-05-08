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

/** Stream GET — query time variano per endpoint (upload vs summary vs calendarDate): vedi `fetchGarminWellnessSnapshotForStream`. */
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

/** Path REST primario — camelCase Wellness API prod. */
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

/** Path alternativi se il primario risponde 400/404 (portale usa spesso `hrvSummary` per push). */
function garminSnapshotRestPathsToTry(stream: GarminWellnessSnapshotStream): string[] {
  const primary = garminSnapshotRestPath(stream);
  const extras: Partial<Record<GarminWellnessSnapshotStream, string[]>> = {
    hrv: ["/rest/hrvSummary"],
    respiration: ["/rest/allDayRespiration"],
  };
  const tail = extras[stream] ?? [];
  return [primary, ...tail.filter((p) => p !== primary)];
}

/** Date UTC ISO (YYYY-MM-DD) che intersecano [startSec, endSec]. */
function utcCalendarDatesInRange(startSec: number, endSec: number, maxDays: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const startMs = Math.min(startSec, endSec) * 1000;
  const endMs = Math.max(startSec, endSec) * 1000;
  let t = Date.UTC(
    new Date(startMs).getUTCFullYear(),
    new Date(startMs).getUTCMonth(),
    new Date(startMs).getUTCDate(),
    0,
    0,
    0,
  );
  const endDay = Date.UTC(new Date(endMs).getUTCFullYear(), new Date(endMs).getUTCMonth(), new Date(endMs).getUTCDate(), 0, 0, 0);
  while (t <= endDay + 86400000 && out.length < maxDays) {
    const s = new Date(t).toISOString().slice(0, 10);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
    t += 86400000;
  }
  return out;
}

function snapshotQueryUrl(path: string, query: Record<string, string>): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const u = new URL(garminWellnessAbsoluteUrl(p));
  for (const [k, v] of Object.entries(query)) {
    u.searchParams.set(k, v);
  }
  return u.toString();
}

function dedupeGarminSummaries(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const r of rows) {
    const sid = typeof r.summaryId === "string" ? r.summaryId : typeof r.summaryId === "number" ? String(r.summaryId) : "";
    const cd =
      typeof r.calendarDate === "string"
        ? r.calendarDate.slice(0, 10)
        : typeof r.calendar_date === "string"
          ? r.calendar_date.slice(0, 10)
          : "";
    const key = sid && cd ? `${sid}|${cd}` : sid || `${cd}|${r.startTimeInSeconds ?? r.endTimeInSeconds ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function utcDateMinusDays(isoYmd: string, delta: number): string {
  const d = new Date(`${isoYmd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
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
  /** Finestra richiesta (UTC, secondi UNIX). */
  windowStartSec: number;
  windowEndSec: number;
}): Promise<
  | { ok: true; httpStatus: number; items: Record<string, unknown>[]; queryStrategy?: string }
  | { ok: false; httpStatus: number; errorMessage: string }
> {
  const winStart = Math.trunc(params.windowStartSec);
  const winEnd = Math.trunc(params.windowEndSec);
  if (!Number.isFinite(winStart) || !Number.isFinite(winEnd) || winStart >= winEnd) {
    return { ok: false, httpStatus: 400, errorMessage: "invalid_time_window" };
  }

  const shortStart = Math.max(winStart, winEnd - 86400);
  const paths = garminSnapshotRestPathsToTry(params.stream);
  const rangeCal = utcCalendarDatesInRange(winStart, winEnd, 6);
  const endIso = new Date(winEnd * 1000).toISOString().slice(0, 10);
  const calPriority = [endIso, utcDateMinusDays(endIso, -1), utcDateMinusDays(endIso, -2)];
  const calOrdered: string[] = [];
  const seenCal = new Set<string>();
  for (const d of [...calPriority, ...rangeCal]) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && !seenCal.has(d)) {
      seenCal.add(d);
      calOrdered.push(d);
    }
  }

  const attemptSpecs: Array<{ label: string; url: string }> = [];
  for (const path of paths) {
    for (const cal of calOrdered.slice(0, 7)) {
      attemptSpecs.push({
        label: `${path}|calendarDate:${cal}`,
        url: snapshotQueryUrl(path, { calendarDate: cal }),
      });
    }
    attemptSpecs.push(
      {
        label: `${path}|summary:${winStart}-${winEnd}`,
        url: snapshotQueryUrl(path, {
          summaryStartTimeInSeconds: String(winStart),
          summaryEndTimeInSeconds: String(winEnd),
        }),
      },
      {
        label: `${path}|upload:${winStart}-${winEnd}`,
        url: snapshotQueryUrl(path, {
          uploadStartTimeInSeconds: String(winStart),
          uploadEndTimeInSeconds: String(winEnd),
        }),
      },
      {
        label: `${path}|summary24h`,
        url: snapshotQueryUrl(path, {
          summaryStartTimeInSeconds: String(shortStart),
          summaryEndTimeInSeconds: String(winEnd),
        }),
      },
      {
        label: `${path}|upload24h`,
        url: snapshotQueryUrl(path, {
          uploadStartTimeInSeconds: String(shortStart),
          uploadEndTimeInSeconds: String(winEnd),
        }),
      },
    );
  }

  let lastFail: { httpStatus: number; errorMessage: string } | null = null;
  let lastOkEmpty: { httpStatus: number; queryStrategy: string } | null = null;

  for (const spec of attemptSpecs) {
    const res = await fetch(spec.url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.accessToken.trim()}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    const text = await res.text();

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        httpStatus: res.status,
        errorMessage: tryParseGarminApiErrorMessage(text) ?? text.slice(0, 900),
      };
    }

    if (!res.ok) {
      lastFail = {
        httpStatus: res.status,
        errorMessage: tryParseGarminApiErrorMessage(text) ?? text.slice(0, 320),
      };
      if (res.status !== 400 && res.status !== 404) {
        break;
      }
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      lastFail = { httpStatus: 502, errorMessage: "invalid_json_snapshot" };
      continue;
    }

    const slice = dedupeGarminSummaries(extractGarminWellnessSummaryList(parsed, params.stream));
    const label = spec.label.slice(0, 240);
    if (slice.length > 0) {
      return {
        ok: true,
        httpStatus: res.status,
        items: slice,
        queryStrategy: label,
      };
    }
    lastOkEmpty ??= { httpStatus: res.status, queryStrategy: label };
  }

  if (lastOkEmpty) {
    return {
      ok: true,
      httpStatus: lastOkEmpty.httpStatus,
      items: [],
      queryStrategy: lastOkEmpty.queryStrategy,
    };
  }

  return {
    ok: false,
    httpStatus: lastFail?.httpStatus ?? 502,
    errorMessage: lastFail?.errorMessage ?? "garmin_wellness_snapshot_exhausted",
  };
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
  /** Ultima query Garmin che ha prodotto 200 / errore parsabile. */
  queryStrategy?: string;
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
      windowStartSec: start,
      windowEndSec: end,
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
              snapshot_time_window_utc: {
                windowStartTimeInSeconds: start,
                windowEndTimeInSeconds: end,
              },
              garmin_query_strategy: fr.queryStrategy ?? null,
            },
            parserEngine: "garmin_wellness_rest_snapshot",
            parserVersion: "2",
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
        queryStrategy: fr.queryStrategy,
      });
    }

    if (i < streams.length - 1) {
      await new Promise((r) => setTimeout(r, 220));
    }
  }

  return { results, uploadStart: start, uploadEnd: end };
}
