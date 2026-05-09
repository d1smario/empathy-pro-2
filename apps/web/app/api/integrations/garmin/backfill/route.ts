import { type NextRequest, NextResponse } from "next/server";

import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { ensureFreshGarminAccessTokenForAthlete } from "@/lib/integrations/garmin-access-token";
import {
  GARMIN_SUMMARY_BACKFILL_STREAMS,
  maxRangeSecondsForGarminSummaryBackfillStream,
  type GarminSummaryBackfillStream,
} from "@/lib/integrations/garmin-summary-backfill-streams";
import {
  batchHasGarminSummaryBackfill412,
  GARMIN_SUMMARY_BACKFILL_412_HINT_IT,
  isGarminSummaryBackfillStream,
  readGarminBackfillInterRequestDelayMs,
  requestGarminSummaryBackfill,
} from "@/lib/integrations/garmin-wellness-backfill";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

type Body = {
  athleteId?: string;
  /** Singolo stream (retrocompatibile). */
  stream?: string;
  /** Più stream nella stessa finestra temporale (sequenziale lato server). */
  streams?: string[];
  summaryStartTimeInSeconds?: number;
  summaryEndTimeInSeconds?: number;
  /** Se mancano start/end: ultimi N giorni UTC (clamp 1–365). Oltre il limite per stream (~90g Health, ~30g Activity) il server taglia la finestra. */
  days?: number;
};

function clampGarminBackfillDays(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.min(365, Math.max(1, Math.floor(n)));
}

function resolveGarminBackfillWindow(body: Body): { start: number; end: number } | { error: string } {
  const startRaw = body.summaryStartTimeInSeconds;
  const endRaw = body.summaryEndTimeInSeconds;
  const hasStart = typeof startRaw === "number" && Number.isFinite(startRaw);
  const hasEnd = typeof endRaw === "number" && Number.isFinite(endRaw);
  if (hasStart && hasEnd) {
    const start = Math.trunc(startRaw);
    const end = Math.trunc(endRaw);
    if (start >= end) {
      return { error: "summaryStartTimeInSeconds deve essere minore di summaryEndTimeInSeconds." };
    }
    return { start, end };
  }
  const days = clampGarminBackfillDays(body.days);
  if (days != null) {
    const end = Math.floor(Date.now() / 1000);
    return { start: end - days * 86400, end };
  }
  return {
    error: "Passa summaryStartTimeInSeconds e summaryEndTimeInSeconds, oppure days.",
  };
}

/** Elenco stream + metadati finestra (limite singola richiesta Garmin, dipende dallo stream). */
export async function GET() {
  const maxRangeSecondsByStream = Object.fromEntries(
    GARMIN_SUMMARY_BACKFILL_STREAMS.map((s) => [s, maxRangeSecondsForGarminSummaryBackfillStream(s)]),
  ) as Record<string, number>;
  return NextResponse.json(
    {
      streams: [...GARMIN_SUMMARY_BACKFILL_STREAMS],
      maxRangeSecondsByStream,
      maxRangeDaysWellness: 90,
      maxRangeDaysActivityStreams: 30,
    },
    { headers: NO_STORE },
  );
}

/**
 * Richiesta **Summary Backfill** Garmin (GET wellness `…/rest/backfill/<stream>`) per l’atleta collegato.
 * Body JSON:
 * - Singolo: `athleteId`, `stream`, `summaryStartTimeInSeconds`, `summaryEndTimeInSeconds` **oppure** `days`.
 * - Batch: `athleteId`, `streams: string[]`, stessa finestra (`start`+`end` o `days`).
 * Richiede sessione + accesso in lettura all’atleta; usa token OAuth2 salvato in `garmin_athlete_links`.
 */
export async function POST(req: NextRequest) {
  try {
    let body: Body = {};
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Body JSON richiesto." }, { status: 400, headers: NO_STORE });
    }

    const athleteId = String(body.athleteId ?? "").trim();
    const streamSingle = String(body.stream ?? "").trim();
    const streamsRaw = Array.isArray(body.streams) ? body.streams : null;

    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }

    const window = resolveGarminBackfillWindow(body);
    if ("error" in window) {
      return NextResponse.json({ error: window.error }, { status: 400, headers: NO_STORE });
    }
    const { start, end } = window;

    await requireAthleteReadContext(req, athleteId);

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "service_role_unconfigured" }, { status: 503, headers: NO_STORE });
    }

    const tok = await ensureFreshGarminAccessTokenForAthlete(admin, athleteId);
    if ("error" in tok) {
      return NextResponse.json({ error: tok.error }, { status: 400, headers: NO_STORE });
    }

    const token = tok.accessToken;

    const batchList =
      streamsRaw != null && streamsRaw.length > 0
        ? streamsRaw.map((s) => String(s ?? "").trim()).filter(Boolean)
        : streamSingle
          ? [streamSingle]
          : [];

    if (batchList.length === 0) {
      return NextResponse.json(
        { error: "Specifica stream oppure streams (array non vuoto)." },
        { status: 400, headers: NO_STORE },
      );
    }

    if (streamsRaw != null && streamsRaw.length > 0 && streamSingle) {
      return NextResponse.json(
        { error: "Non combinare stream e streams nello stesso body." },
        { status: 400, headers: NO_STORE },
      );
    }

    const invalid = batchList.filter((s) => !isGarminSummaryBackfillStream(s));
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: "Uno o più stream non validi.",
          invalid,
          allowed: [...GARMIN_SUMMARY_BACKFILL_STREAMS],
        },
        { status: 400, headers: NO_STORE },
      );
    }

    const streams = batchList as GarminSummaryBackfillStream[];

    if (streams.length === 1) {
      const stream = streams[0]!;
      const maxDaysOne = Math.floor(maxRangeSecondsForGarminSummaryBackfillStream(stream) / 86_400);
      const result = await requestGarminSummaryBackfill({
        accessToken: token,
        stream,
        summaryStartTimeInSeconds: start,
        summaryEndTimeInSeconds: end,
      });

      if (result.ok) {
        const dupNote = result.garminSoftDuplicate ? " Finestra già richiesta in precedenza (idempotente)." : "";
        const baseMsg =
          result.httpStatus === 202
            ? `Backfill accettato da Garmin (202); i dati possono arrivare in seguito via Push/Ping.${dupNote}`
            : `Richiesta completata.${dupNote}`;
        const msg = result.windowClamped
          ? `${baseMsg} Intervallo richiesto superava il limite Garmin per questo stream (${maxDaysOne} giorni per richiesta): è stata usata solo la parte più recente.`
          : baseMsg;
        return NextResponse.json(
          {
            ok: true as const,
            stream,
            httpStatus: result.httpStatus,
            garminSoftDuplicate: Boolean(result.garminSoftDuplicate),
            message: msg.trim(),
            summaryStartTimeInSeconds: start,
            summaryEndTimeInSeconds: end,
            ...(result.windowClamped &&
            result.effectiveSummaryStartTimeInSeconds != null &&
            result.effectiveSummaryEndTimeInSeconds != null
              ? {
                  windowClamped: true as const,
                  effectiveSummaryStartTimeInSeconds: result.effectiveSummaryStartTimeInSeconds,
                  effectiveSummaryEndTimeInSeconds: result.effectiveSummaryEndTimeInSeconds,
                }
              : {}),
          },
          { headers: NO_STORE },
        );
      }

      return NextResponse.json(
        {
          ok: false as const,
          stream,
          httpStatus: result.httpStatus,
          errorMessage: result.errorMessage ?? null,
          ...(result.httpStatus === 412 ? { hint: GARMIN_SUMMARY_BACKFILL_412_HINT_IT } : {}),
        },
        { status: result.httpStatus >= 400 && result.httpStatus < 600 ? result.httpStatus : 502, headers: NO_STORE },
      );
    }

    const results: Array<{
      stream: string;
      ok: boolean;
      httpStatus: number;
      errorMessage?: string | null;
      message?: string;
      windowClamped?: boolean;
      effectiveSummaryStartTimeInSeconds?: number;
      effectiveSummaryEndTimeInSeconds?: number;
      garminSoftDuplicate?: boolean;
    }> = [];

    for (let i = 0; i < streams.length; i += 1) {
      const stream = streams[i]!;
      const result = await requestGarminSummaryBackfill({
        accessToken: token,
        stream,
        summaryStartTimeInSeconds: start,
        summaryEndTimeInSeconds: end,
      });
      if (result.ok) {
        results.push({
          stream,
          ok: true,
          httpStatus: result.httpStatus,
          garminSoftDuplicate: Boolean(result.garminSoftDuplicate),
          message: result.garminSoftDuplicate
            ? "Duplicato/idempotente (Garmin); finestra già nota."
            : result.httpStatus === 202
              ? "Accettato (202); dati possono arrivare via Push/Ping."
              : "OK.",
          ...(result.windowClamped &&
          result.effectiveSummaryStartTimeInSeconds != null &&
          result.effectiveSummaryEndTimeInSeconds != null
            ? {
                windowClamped: true as const,
                effectiveSummaryStartTimeInSeconds: result.effectiveSummaryStartTimeInSeconds,
                effectiveSummaryEndTimeInSeconds: result.effectiveSummaryEndTimeInSeconds,
              }
            : {}),
        });
      } else {
        results.push({
          stream,
          ok: false,
          httpStatus: result.httpStatus,
          errorMessage: result.errorMessage ?? null,
        });
      }
      if (i < streams.length - 1) {
        await new Promise((r) => setTimeout(r, readGarminBackfillInterRequestDelayMs()));
      }
    }

    const allOk = results.every((r) => r.ok);
    const has412 = batchHasGarminSummaryBackfill412(results);
    const has429 = results.some((r) => !r.ok && r.httpStatus === 429);
    const anyStreamWindowClamped = results.some((r) => r.ok && r.windowClamped);
    return NextResponse.json(
      {
        batch: true as const,
        allOk,
        summaryStartTimeInSeconds: start,
        summaryEndTimeInSeconds: end,
        results,
        message: allOk
          ? `Tutte le richieste di backfill sono state accettate da Garmin (controlla 202 per stream).${
              anyStreamWindowClamped
                ? " Per almeno uno stream la finestra è stata ridotta al limite massimo per singola richiesta (es. 30 giorni activityDetails/moveiq, 90 giorni Health)."
                : ""
            }`
          : "Alcune richieste sono fallite; vedi results[].",
        ...(has412 && !allOk ? { hint: GARMIN_SUMMARY_BACKFILL_412_HINT_IT } : {}),
        ...(has429 && !allOk
          ? {
              hint429:
                "Garmin ha restituito 429 (troppo richieste ravvicinate). Riprova tra alcuni minuti; oppure aumenta GARMIN_BACKFILL_INTER_REQUEST_DELAY_MS o GARMIN_BACKFILL_429_MAX_EXTRA_ATTEMPTS sul deploy.",
            }
          : {}),
      },
      { status: 200, headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}
