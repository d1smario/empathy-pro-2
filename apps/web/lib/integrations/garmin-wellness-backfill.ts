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

/** Pausa tra richieste backfill consecutive (stesso token); riduce 429 in batch. Override: `GARMIN_BACKFILL_INTER_REQUEST_DELAY_MS`. */
export function readGarminBackfillInterRequestDelayMs(): number {
  const raw = process.env.GARMIN_BACKFILL_INTER_REQUEST_DELAY_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 0) return Math.min(60_000, n);
  return 1100;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readGarminBackfill429MaxExtraAttempts(): number {
  const raw = process.env.GARMIN_BACKFILL_429_MAX_EXTRA_ATTEMPTS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 0) return Math.min(8, n);
  return 3;
}

function backoffMsAfter429(attemptIndex: number): number {
  const steps = [2500, 5000, 10_000, 15_000, 20_000, 25_000, 30_000, 35_000];
  return steps[Math.min(attemptIndex, steps.length - 1)] ?? 10_000;
}

/** Garmin può rispondere 409 o testo "duplicate backfill" per finestra già richiesta: idempotenza. */
export function garminSummaryBackfillDuplicateResponse(httpStatus: number, bodyText: string): boolean {
  if (httpStatus === 409) return true;
  const t = bodyText.toLowerCase();
  return t.includes("duplicate") && t.includes("backfill");
}

/**
 * Invia una richiesta di backfill storico per lo stream indicato (Bearer utente).
 * In caso di **412 Precondition Failed**, Garmin rifiuta spesso richieste di storico non ammesse
 * per il programme / permessi / finestra: non influenza il Pull su `callbackURL` dopo Push/Ping.
 *
 * Retry automatico su 429 con backoff (variabile GARMIN_BACKFILL_429_MAX_EXTRA_ATTEMPTS).
 * Risposta 409 o testo "duplicate backfill": considerato OK idempotente; HTTP normalizzato a 202 nello snippet UI.
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
      garminSoftDuplicate?: boolean;
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
  const windowExtras = windowClamped
    ? ({
        windowClamped: true as const,
        effectiveSummaryStartTimeInSeconds: start,
        effectiveSummaryEndTimeInSeconds: end,
      } as const)
    : {};

  const maxExtra = readGarminBackfill429MaxExtraAttempts();

  for (let attempt = 0; attempt <= maxExtra; attempt += 1) {
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
        ...windowExtras,
      };
    }

    if (garminSummaryBackfillDuplicateResponse(res.status, text)) {
      return {
        ok: true,
        httpStatus: 202,
        garminSoftDuplicate: true,
        ...windowExtras,
      };
    }

    if (res.status === 429 && attempt < maxExtra) {
      await sleep(backoffMsAfter429(attempt));
      continue;
    }

    return {
      ok: false,
      httpStatus: res.status,
      errorMessage: tryParseGarminApiErrorMessage(text) ?? text.slice(0, 800),
    };
  }

  return {
    ok: false,
    httpStatus: 502,
    errorMessage: "garmin_backfill_retry_loop_exhausted",
  };
}

/** 412 sul Backfill storico: finestra troppo lunga, programma/consenso, o nome stream non ammesso. Diverso dal Push→Pull con `token=` nelle notifiche. */
export const GARMIN_SUMMARY_BACKFILL_412_HINT_IT =
  "412 su Summary Backfill: finestra massima per richiesta dipende dallo stream (~90 giorni Health/wellness, ~30 giorni Activity come activityDetails/moveiq; Empathy taglia automaticamente oltre il limite dello stream). Se già dentro al limite: permesso per quel tipo di summary in Garmin Connect (Appendix error 412), prodotti nel portale, contratto/programma — contatta Garmin Developer support. I dati nuovi restano disponibili via Push→pull dopo sync.";

export function batchHasGarminSummaryBackfill412(results: readonly { ok: boolean; httpStatus: number }[]): boolean {
  return results.some((r) => !r.ok && r.httpStatus === 412);
}
