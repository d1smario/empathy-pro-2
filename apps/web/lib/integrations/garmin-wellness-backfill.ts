import "server-only";

import { tryParseGarminApiErrorMessage } from "@/lib/integrations/garmin-api-error-body";
import {
  GARMIN_SUMMARY_BACKFILL_STREAMS,
  maxRangeSecondsForGarminSummaryBackfillStream,
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

/**
 * Limite “Health/wellness” storico (90 giorni) — usare `maxRangeSecondsForGarminSummaryBackfillStream` per stream Activity (~30g).
 */
export const GARMIN_SUMMARY_BACKFILL_MAX_RANGE_SECONDS = 90 * 86_400;

export function clampGarminSummaryBackfillTimeRange(
  stream: GarminSummaryBackfillStream,
  summaryStartTimeInSeconds: number,
  summaryEndTimeInSeconds: number,
): { start: number; end: number; clamped: boolean } {
  const end = Math.trunc(summaryEndTimeInSeconds);
  let start = Math.trunc(summaryStartTimeInSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return { start, end, clamped: false };
  }
  const span = end - start;
  const max = maxRangeSecondsForGarminSummaryBackfillStream(stream);
  if (span <= max) {
    return { start, end, clamped: false };
  }
  return { start: end - max, end, clamped: true };
}

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
 * In caso di **412 Precondition Failed**, Garmin rifiuta spesso richieste di storico non ammesse
 * per il programme / permessi / finestra: non influenza il Pull su `callbackURL` dopo Push/Ping.
 */
export async function requestGarminSummaryBackfill(params: {
  accessToken: string;
  stream: GarminSummaryBackfillStream;
  summaryStartTimeInSeconds: number;
  summaryEndTimeInSeconds: number;
}): Promise<
  | {
      ok: true;
      httpStatus: number;
      windowClamped?: boolean;
      effectiveSummaryStartTimeInSeconds?: number;
      effectiveSummaryEndTimeInSeconds?: number;
    }
  | { ok: false; httpStatus: number; errorMessage?: string }
> {
  const rawStart = Math.trunc(params.summaryStartTimeInSeconds);
  const rawEnd = Math.trunc(params.summaryEndTimeInSeconds);
  if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) {
    return { ok: false, httpStatus: 400, errorMessage: "invalid_time_range" };
  }
  if (rawStart >= rawEnd) {
    return {
      ok: false,
      httpStatus: 400,
      errorMessage: "summaryStartTimeInSeconds must be less than summaryEndTimeInSeconds",
    };
  }

  const { start, end, clamped: windowClamped } = clampGarminSummaryBackfillTimeRange(
    params.stream,
    rawStart,
    rawEnd,
  );
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
    return {
      ok: true,
      httpStatus: res.status,
      ...(windowClamped
        ? {
            windowClamped: true as const,
            effectiveSummaryStartTimeInSeconds: start,
            effectiveSummaryEndTimeInSeconds: end,
          }
        : {}),
    };
  }
  return {
    ok: false,
    httpStatus: res.status,
    errorMessage: tryParseGarminApiErrorMessage(text) ?? text.slice(0, 800),
  };
}

/** 412 sul Backfill storico: finestra troppo lunga, programma/consenso, o nome stream non ammesso. Diverso dal Push→Pull con `token=` nelle notifiche. */
export const GARMIN_SUMMARY_BACKFILL_412_HINT_IT =
  "412 su Summary Backfill: finestra massima per richiesta dipende dallo stream (~90 giorni Health/wellness, ~30 giorni Activity come activityDetails/moveiq; Empathy taglia automaticamente oltre il limite dello stream). Se già dentro al limite: permesso per quel tipo di summary in Garmin Connect (Appendix error 412), prodotti nel portale, contratto/programma — contatta Garmin Developer support. I dati nuovi restano disponibili via Push→pull dopo sync.";

export function batchHasGarminSummaryBackfill412(results: readonly { ok: boolean; httpStatus: number }[]): boolean {
  return results.some((r) => !r.ok && r.httpStatus === 412);
}
