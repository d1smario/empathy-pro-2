import "server-only";

import { isGarminActivitySummaryStreamKey } from "@/lib/integrations/garmin-health-api-notification-schema";
import { parseGarminWellnessLogicalDay } from "@/lib/integrations/garmin-wellness-day-parse";
import { persistRealityDeviceExport } from "@/lib/reality/provider-adapters";
import {
  buildSleepRecoveryCanonicalPreview,
  buildSleepRecoveryCoverage,
} from "@/lib/reality/sleep-recovery-signals";

/**
 * Chiavi radice tipiche Ping/Push/pull JSON Garmin (Wellness API) — esclusi stream attività.
 * `epochs` omesso: troppo denso; si può aggiungere con policy dedicata.
 */
const WELLNESS_ROOT_KEYS = new Set([
  "dailies",
  "sleeps",
  "hrv",
  "stressDetails",
  "bodyComps",
  "userMetrics",
  "pulseox",
  "pulseOx",
  "allDayRespiration",
  "respiration",
  "healthSnapshot",
  "bloodPressures",
  "skinTemp",
  "solarIntensity",
]);

/** Chiavi radice che il portale Garmin a volte usa negli URL (`…/BodyCompositions`) ma nel JSON possono differire da Wellness API (`bodyComps`). */
const WELLNESS_ROOT_ALIASES: Record<string, string> = {
  bodycompositions: "bodyComps",
  bodycomposition: "bodyComps",
  bloodpressure: "bloodPressures",
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function canonWellnessKey(k: string): string | null {
  const lower = k.toLowerCase().trim();
  const viaAlias = WELLNESS_ROOT_ALIASES[lower];
  if (viaAlias) return viaAlias;
  for (const known of WELLNESS_ROOT_KEYS) {
    if (known.toLowerCase() === lower) return known;
  }
  return null;
}

export function garminWellnessCalendarDay(rec: Record<string, unknown>): string | null {
  return parseGarminWellnessLogicalDay(rec);
}

function wellnessDomain(streamKey: string): "sleep" | "recovery" | "health" {
  const s = streamKey.toLowerCase();
  if (s === "sleeps") return "sleep";
  if (s === "hrv" || s === "usermetrics") return "recovery";
  return "health";
}

function stableExternalEventId(streamKey: string, rec: Record<string, unknown>, calendarDay: string | null): string {
  const sid = rec.summaryId ?? rec.summary_id;
  if (typeof sid === "string" && sid.trim()) return `gw:${streamKey}:${sid.trim()}`;
  if (typeof sid === "number" && Number.isFinite(sid)) return `gw:${streamKey}:${String(Math.trunc(sid))}`;
  const uidRaw = rec.userId ?? rec.user_id;
  const uid = typeof uidRaw === "string" && uidRaw.trim() ? uidRaw.trim() : "na";
  const day = calendarDay ?? "nodate";
  return `gw:${uid}:${streamKey}:${day}`;
}

export function collectGarminWellnessRecords(body: unknown): Array<{ streamKey: string; rec: Record<string, unknown> }> {
  const root = asRecord(body);
  if (!root) return [];
  const out: Array<{ streamKey: string; rec: Record<string, unknown> }> = [];
  for (const [k, v] of Object.entries(root)) {
    const canon = canonWellnessKey(k);
    if (!canon || isGarminActivitySummaryStreamKey(canon)) continue;
    if (!Array.isArray(v)) continue;
    for (const item of v) {
      const rec = asRecord(item);
      if (rec && Object.keys(rec).length > 0) out.push({ streamKey: canon, rec });
    }
  }
  return out;
}

export function shouldMaterializeGarminWellness(input: {
  streamKey?: string | null;
  endpointKind: string;
  responseBody: unknown;
}): boolean {
  const sk = input.streamKey?.trim();
  if (sk && isGarminActivitySummaryStreamKey(sk)) return false;
  if (sk) {
    const canon = canonWellnessKey(sk);
    if (canon) return true;
  }
  return collectGarminWellnessRecords(input.responseBody).length > 0;
}

/**
 * Dopo pull HTTP 200 su stream wellness (dailies, sleeps, hrv, …), persiste righe in `device_sync_exports`
 * così `daily-wellness-panel` / calendar possono leggere come per WHOOP.
 */
export async function materializeGarminWellnessFromPullResponse(input: {
  athleteId: string;
  streamKey?: string | null;
  responseBody: unknown;
}): Promise<{ persisted: number }> {
  const items = collectGarminWellnessRecords(input.responseBody);
  if (items.length === 0) return { persisted: 0 };

  let persisted = 0;
  for (const { streamKey, rec } of items) {
    const day = garminWellnessCalendarDay(rec);
    const extId = stableExternalEventId(streamKey, rec, day);
    try {
      const cov = buildSleepRecoveryCoverage(rec);
      await persistRealityDeviceExport(
        {
          athleteId: input.athleteId,
          provider: "garmin",
          domain: wellnessDomain(streamKey),
          sourceKind: "api_sync",
          externalRef: extId,
          sessionDate: day,
          createdAt: day ? `${day}T12:00:00.000Z` : null,
          payload: { ...rec, garmin_wellness_stream: streamKey },
          canonicalPreview: buildSleepRecoveryCanonicalPreview(rec),
          channelCoverage: cov.channelCoverage,
          missingChannels: cov.missingChannels,
          recommendedInputs: cov.recommendedInputs,
          qualityStatus: cov.coveragePct >= 40 ? "OK" : "SPARSE",
          qualityNote: `Garmin ${streamKey} pull`,
          parserEngine: `garmin_wellness_api:${streamKey}`,
          parserVersion: "1",
        },
        { upsertOnProviderExternalId: true },
      );
      persisted += 1;
    } catch {
      /* dedup / envelope: skip singola riga */
    }
  }
  return { persisted };
}
