import { type NextRequest, NextResponse } from "next/server";

import { runGarminPartnerAdminEffects } from "@/lib/integrations/garmin-admin-webhooks";
import { verifyGarminPushWebhookAuth } from "@/lib/integrations/garmin-push-webhook-auth";
import { persistGarminPushReceipt } from "@/lib/integrations/garmin-push-persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vedi `verifyGarminPushWebhookAuth`: token Empathy opzionale **oppure** identità app Garmin
 * (`garmin-client-id` / `oauth_consumer_key` = stesso Client ID del portale), così il portale
 * non deve appendere `?token=` agli URL fissi (evita 401 su es. CONSUMER_PERMISSIONS).
 */

function endpointKindFromParams(segments: string[] | undefined): string {
  if (!segments?.length) return "unspecified";
  return segments.join("/").slice(0, 200);
}

/**
 * Partner Verification Garmin: nel portale servono anche (oltre agli stream dati):
 * - Deregistration → `.../push/deregistration` (rimuove link atleta in DB se `userId` nel body)
 * - User permissions change → `.../push/userPermissions` (solo audit in `garmin_push_receipts`)
 * - Ping → `.../push/ping` se richiesto dal test (“almeno 1 altro endpoint” oltre ai due sopra)
 * Con `GARMIN_PUSH_WEBHOOK_SECRET`: aggiungi `?token=` **oppure** lascia che Garmin invii il client id (vedi `garmin-push-webhook-auth.ts`).
 */

/**
 * GET: reachability (test manuale / verifiche che non inviano ancora POST con body).
 * Non richiede `?token=`: reachability Garmin. Il POST usa `verifyGarminPushWebhookAuth`.
 */
export async function GET(
  _req: NextRequest,
  context: { params: { segments?: string[] } },
) {
  const kind = endpointKindFromParams(context.params.segments);
  return NextResponse.json({
    ok: true as const,
    service: "empathy-pro2-garmin-push",
    endpointKind: kind,
    hint: "Garmin invia POST con JSON (dailies, activities, …). Configura nel portale un URL HTTPS per tipo.",
  });
}

/** Reachability: alcuni check usano HEAD (senza body). */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

/**
 * POST: riceve notifiche push Garmin (metadata + callbackURL per pull).
 * Esempio URL per riga nel portale:
 *   https://<host>/api/integrations/garmin/push/dailies
 *   https://<host>/api/integrations/garmin/push/activities
 */
export async function POST(
  req: NextRequest,
  context: { params: { segments?: string[] } },
) {
  const kind = endpointKindFromParams(context.params.segments);
  const contentType = req.headers.get("content-type");
  const raw = await req.text();

  if (!verifyGarminPushWebhookAuth(req, raw)) {
    return NextResponse.json(
      {
        error:
          "Push non autorizzato. Con GARMIN_PUSH_WEBHOOK_SECRET: ?token= / x-empathy-garmin-secret, oppure firma OAuth1 HMAC-SHA1 valida (consumer key+secret come in Vercel), oppure garmin-client-id. Se la firma fallisce per URL, imposta GARMIN_PUSH_PUBLIC_BASE_URL=https://<host> (senza slash finale).",
      },
      { status: 401 },
    );
  }
  let parsed: unknown = { raw: raw.slice(0, 50_000) };
  if (raw.trim().length > 0) {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = { parse_error: true, raw_prefix: raw.slice(0, 2000) };
    }
  }

  try {
    const admin = await runGarminPartnerAdminEffects({ endpointKind: kind, parsedJson: parsed });
    const { id, pullJobsQueued } = await persistGarminPushReceipt({
      endpointKind: kind,
      contentType,
      parsedJson: parsed,
    });
    return NextResponse.json(
      {
        ok: true as const,
        id,
        endpointKind: kind,
        pullJobsQueued,
        deregistrationRemoved: admin.deregistrationRemoved,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Persistenza push fallita.";
    const status = message.includes("SUPABASE_SERVICE_ROLE_KEY") ? 503 : 500;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
