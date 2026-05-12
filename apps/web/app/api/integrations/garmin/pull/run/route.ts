import { type NextRequest, NextResponse } from "next/server";

import {
  authorizeGarminPullEndpointBearer,
  garminPullEndpointSecretConfigured,
} from "@/lib/integrations/garmin-pull-endpoint-auth";
import { runGarminPullJobs } from "@/lib/integrations/garmin-pull-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Esegue job pull in coda (dopo push Garmin). Proteggi con segreto.
 *
 * Portale Garmin — lato sinistro:
 * - **API Pull Token / API Configuration** → `GARMIN_OAUTH_CONSUMER_KEY` + `GARMIN_OAUTH_CONSUMER_SECRET`
 * - **Endpoint Configuration (push)** → POST verso `/api/integrations/garmin/push/...`
 * - **OAuth2 User Authorization** → redirect `/api/integrations/garmin/callback`
 * - **Summary Backfill** → anche `POST /api/integrations/garmin/backfill` (range UTC + `stream`) oltre agli strumenti portale
 *
 * Chiamata esempio (Bearer = `GARMIN_PULL_RUN_SECRET` **oppure** lo stesso `CRON_SECRET` usato da GET …/pull/cron):
 *   curl -X POST https://<host>/api/integrations/garmin/pull/run \
 *     -H "Authorization: Bearer $GARMIN_PULL_RUN_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"limit":5}'
 *
 * Su **Vercel Cron** (solo GET) usa `GET /api/integrations/garmin/pull/cron` con `CRON_SECRET` (vedi `vercel.json`).
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false as const,
      error: "Usa POST con Authorization: Bearer e body JSON opzionale { limit: number }.",
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function POST(req: NextRequest) {
  if (
    !garminPullEndpointSecretConfigured() ||
    !authorizeGarminPullEndpointBearer(req)
  ) {
    return NextResponse.json({ ok: false as const, error: "Non autorizzato." }, { status: 401 });
  }

  let limit = 5;
  try {
    const body = (await req.json()) as { limit?: number };
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) {
      limit = Math.min(25, Math.max(1, Math.floor(body.limit)));
    }
  } catch {
    /* body vuoto → default */
  }

  try {
    const result = await runGarminPullJobs(limit);
    return NextResponse.json({
      ok: true as const,
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
      errors: result.errors,
      activitiesUpserted: result.activitiesUpserted,
      activityBlobsStored: result.activityBlobsStored,
      wellnessExportsUpserted: result.wellnessExportsUpserted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Esecuzione pull fallita.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
