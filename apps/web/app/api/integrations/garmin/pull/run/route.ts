import { type NextRequest, NextResponse } from "next/server";

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
 * - **Backfill / Data Viewer** → strumenti portale; dati già in coda possono essere riallineati con nuove push
 *
 * Chiamata esempio:
 *   curl -X POST https://<host>/api/integrations/garmin/pull/run \
 *     -H "Authorization: Bearer $GARMIN_PULL_RUN_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"limit":5}'
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
  const secret = process.env.GARMIN_PULL_RUN_SECRET?.trim();
  const auth = req.headers.get("authorization")?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
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
    return NextResponse.json({ ok: true as const, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Esecuzione pull fallita.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
