import { type NextRequest, NextResponse } from "next/server";

import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { ensureFreshGarminAccessTokenForAthlete } from "@/lib/integrations/garmin-access-token";
import { GARMIN_SUMMARY_BACKFILL_STREAMS } from "@/lib/integrations/garmin-summary-backfill-streams";
import { isGarminSummaryBackfillStream, requestGarminSummaryBackfill } from "@/lib/integrations/garmin-wellness-backfill";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

type Body = {
  athleteId?: string;
  stream?: string;
  summaryStartTimeInSeconds?: number;
  summaryEndTimeInSeconds?: number;
};

/** Elenco stream `…/rest/backfill/<stream>` (stesso elenco di apiDocs / `garmin-summary-backfill-streams.ts`). */
export async function GET() {
  return NextResponse.json({ streams: [...GARMIN_SUMMARY_BACKFILL_STREAMS] }, { headers: NO_STORE });
}

/**
 * Richiesta **Summary Backfill** Garmin (GET wellness `…/rest/backfill/<stream>`) per l’atleta collegato.
 * Body JSON: `athleteId`, `stream` (uno di `GARMIN_SUMMARY_BACKFILL_STREAMS`), `summaryStartTimeInSeconds`, `summaryEndTimeInSeconds`.
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
    const stream = String(body.stream ?? "").trim();
    const start = body.summaryStartTimeInSeconds;
    const end = body.summaryEndTimeInSeconds;

    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }
    if (!isGarminSummaryBackfillStream(stream)) {
      return NextResponse.json(
        {
          error: "stream non valido.",
          allowed: [...GARMIN_SUMMARY_BACKFILL_STREAMS],
        },
        { status: 400, headers: NO_STORE },
      );
    }
    if (typeof start !== "number" || typeof end !== "number" || !Number.isFinite(start) || !Number.isFinite(end)) {
      return NextResponse.json(
        { error: "summaryStartTimeInSeconds e summaryEndTimeInSeconds devono essere numeri finiti." },
        { status: 400, headers: NO_STORE },
      );
    }

    await requireAthleteReadContext(req, athleteId);

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "service_role_unconfigured" }, { status: 503, headers: NO_STORE });
    }

    const tok = await ensureFreshGarminAccessTokenForAthlete(admin, athleteId);
    if ("error" in tok) {
      return NextResponse.json({ error: tok.error }, { status: 400, headers: NO_STORE });
    }

    const result = await requestGarminSummaryBackfill({
      accessToken: tok.accessToken,
      stream,
      summaryStartTimeInSeconds: start,
      summaryEndTimeInSeconds: end,
    });

    if (result.ok) {
      return NextResponse.json(
        {
          ok: true as const,
          stream,
          httpStatus: result.httpStatus,
          message:
            result.httpStatus === 202
              ? "Backfill accettato da Garmin (202); i dati possono arrivare in seguito via Push/Ping."
              : "Richiesta completata.",
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
      },
      { status: result.httpStatus >= 400 && result.httpStatus < 600 ? result.httpStatus : 502, headers: NO_STORE },
    );
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}
