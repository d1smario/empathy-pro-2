import { type NextRequest, NextResponse } from "next/server";

import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

const BODY = {
  ok: false as const,
  /** Allineamento Health API Garmin: OAuth2 vale per utente/consenso; molti GET `/rest/dailies` ecc. richiedono `token` sulla URL di pull (notifica Ping/Push), non Bearer da solo → `InvalidPullTokenException`. */
  code: "garmin_wellness_pull_requires_notification_token" as const,
  hint: `I riepiloghi wellness (dailies, sleeps, stress…) su apis.garmin.com vanno di norma scaricati usando l’URL ricevuto dalla notifica Push/Ping, con il parametro token (pull token) e la firma OAuth1 del partner (come fa già garmin-pull-runner sui garmin_pull_jobs). L’OAuth2 PKCE serve per collegare l’utente, refresh e chiamate tipo GET /rest/user/id e /rest/user/permissions (Elena Garmin).`,
  supportedPath: [
    "Portale Garmin: endpoint Push abilitati → POST /api/integrations/garmin/push/…",
    "Cron / POST …/garmin/pull/run → esegue GET su callbackURL dalla coda con OAuth1 o Bearer+athlete",
    "Summary Backfill (se abilitato sul contratto) → GET /rest/backfill/<stream> …",
  ],
} as const;

/**
 * Riservato per chiarire il modello dati Garmin. **Non** implementa un pull “sintetico”: senza `token`
 * dalla Ping/Push la Wellness API risponde `InvalidPullTokenException` (HTTP 400).
 */
export async function GET() {
  return NextResponse.json(BODY, { status: 422, headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  try {
    let bodyJson: Record<string, unknown> = {};
    try {
      bodyJson = ((await req.json()) as Record<string, unknown>) ?? {};
    } catch {
      return NextResponse.json({ error: "Body JSON richiesto." }, { status: 400, headers: NO_STORE });
    }

    const athleteId = String(bodyJson.athleteId ?? "").trim();
    if (!athleteId) {
      return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
    }

    await requireAthleteReadContext(req, athleteId);

    return NextResponse.json(BODY, { status: 422, headers: NO_STORE });
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    }
    throw e;
  }
}
