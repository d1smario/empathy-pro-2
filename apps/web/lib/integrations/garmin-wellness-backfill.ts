import "server-only";

import { tryParseGarminApiErrorMessage } from "@/lib/integrations/garmin-api-error-body";
import {
  GARMIN_SUMMARY_BACKFILL_STREAMS,
  type GarminSummaryBackfillStream,
} from "@/lib/integrations/garmin-summary-backfill-streams";
import { garminWellnessAbsoluteUrl } from "@/lib/integrations/garmin-wellness-api";

export { GARMIN_SUMMARY_BACKFILL_STREAMS, type GarminSummaryBackfillStream };

/**
 * Summary Backfill (Wellness API, sezione omonima in apiDocs).
 * Ogni endpoint è **GET** `…/wellness-api/rest/backfill/<stream>` con query obbligatorie:
 * `summaryStartTimeInSeconds`, `summaryEndTimeInSeconds` (UTC, secondi; tipo query **string** in OpenAPI).
 * Risposta di successo tipica **202 Accepted** (elaborazione asincrona; i dati possono arrivare poi via Push/Ping).
 *
 * @see https://apis.garmin.com/tools/apiDocs
 */

const STREAM_SET = new Set<string>(GARMIN_SUMMARY_BACKFILL_STREAMS);

export function isGarminSummaryBackfillStream(s: string): s is GarminSummaryBackfillStream {
  return STREAM_SET.has(s);
}

export function buildGarminSummaryBackfillRequestUrl(
  stream: GarminSummaryBackfillStream,
  summaryStartTimeInSeconds: number,
  summaryEndTimeInSeconds: number,
): string {
  const u = new URL(garminWellnessAbsoluteUrl(`/rest/backfill/${stream}`));
  u.searchParams.set("summaryStartTimeInSeconds", String(Math.trunc(summaryStartTimeInSeconds)));
  u.searchParams.set("summaryEndTimeInSeconds", String(Math.trunc(summaryEndTimeInSeconds)));
  return u.toString();
}

/**
 * Invia una richiesta di backfill storico per lo stream indicato (Bearer utente).
 */
export async function requestGarminSummaryBackfill(params: {
  accessToken: string;
  stream: GarminSummaryBackfillStream;
  summaryStartTimeInSeconds: number;
  summaryEndTimeInSeconds: number;
}): Promise<
  { ok: true; httpStatus: number } | { ok: false; httpStatus: number; errorMessage?: string }
> {
  const start = Math.trunc(params.summaryStartTimeInSeconds);
  const end = Math.trunc(params.summaryEndTimeInSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { ok: false, httpStatus: 400, errorMessage: "invalid_time_range" };
  }
  if (start >= end) {
    return {
      ok: false,
      httpStatus: 400,
      errorMessage: "summaryStartTimeInSeconds must be less than summaryEndTimeInSeconds",
    };
  }

  const url = buildGarminSummaryBackfillRequestUrl(params.stream, start, end);
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${params.accessToken.trim()}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (res.ok) {
    return { ok: true, httpStatus: res.status };
  }
  return {
    ok: false,
    httpStatus: res.status,
    errorMessage: tryParseGarminApiErrorMessage(text) ?? text.slice(0, 800),
  };
}
