import "server-only";

import type { NextRequest } from "next/server";

import {
  garminPushSigningUrlFromIncoming,
  verifyGarminPushWebhookAuthPlain,
} from "@/lib/integrations/garmin-push-webhook-auth-plain";

/** URL firmata OAuth come nel route Garmin (`pathname` + `search`; proxy → forwarded Host/Proto). */
export function garminPushRequestUrlForSigning(req: NextRequest): string {
  const path = req.nextUrl.pathname + req.nextUrl.search;
  return garminPushSigningUrlFromIncoming(path, req.headers.get("x-forwarded-proto"), req.headers.get("x-forwarded-host"));
}

/**
 * Autenticazione richieste POST push dal cloud Garmin.
 *
 * - Senza `GARMIN_PUSH_WEBHOOK_SECRET` → accetta (solo HTTPS / rate limit infra).
 * - Con secret: `?token=` / `x-empathy-garmin-secret` **oppure** `garmin-client-id` uguale a un client id noto
 *   **oppure** `Authorization: OAuth` con **firma OAuth1 valida** (HMAC-SHA1 o PLAINTEXT; tipico push portale incluso CONSUMER_PERMISSIONS).
 */
export function verifyGarminPushWebhookAuth(req: NextRequest, rawBody: string): boolean {
  const path = req.nextUrl.pathname + req.nextUrl.search;
  return verifyGarminPushWebhookAuthPlain({
    pathWithSearch: path,
    forwardedProto: req.headers.get("x-forwarded-proto"),
    forwardedHost: req.headers.get("x-forwarded-host"),
    rawBody,
    queryToken: req.nextUrl.searchParams.get("token"),
    headerGet: (name) => req.headers.get(name),
  });
}
