import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";
import OAuth from "oauth-1.0a";

function timingSafeStringEq(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** URL assoluta come la vede Garmin (proxy Vercel: X-Forwarded-*). */
export function garminPushRequestUrlForSigning(req: NextRequest): string {
  const explicit = process.env.GARMIN_PUSH_PUBLIC_BASE_URL?.trim();
  if (explicit) {
    const path = req.nextUrl.pathname + req.nextUrl.search;
    const base = explicit.replace(/\/$/, "");
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }
  const u = req.nextUrl.clone();
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (proto && host) {
    u.protocol = `${proto}:`;
    u.host = host;
  }
  return u.toString();
}

/** Solo parametri `oauth_*` dall’header `Authorization: OAuth …`. */
function parseOAuthParamsFromAuthorization(authHeader: string): Record<string, string> | null {
  const a = authHeader.trim();
  if (!a.toLowerCase().startsWith("oauth ")) return null;
  const rest = a.slice(6);
  const out: Record<string, string> = {};
  const re = /([a-zA-Z0-9_]+)\s*=\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    const key = m[1];
    if (!key.startsWith("oauth_")) continue;
    out[key] = m[2].replace(/\\"/g, '"');
  }
  return Object.keys(out).length ? out : null;
}

function extractOAuthConsumerKeyFromAuthorization(authHeader: string): string | null {
  const p = parseOAuthParamsFromAuthorization(authHeader);
  return p?.oauth_consumer_key?.trim() || null;
}

function garminTrustedClientIds(): string[] {
  return [
    process.env.GARMIN_OAUTH2_CLIENT_ID?.trim(),
    process.env.GARMIN_OAUTH_CONSUMER_KEY?.trim(),
  ].filter((x): x is string => Boolean(x));
}

function resolveConsumerForIncomingOAuth(consumerKey: string): { key: string; secret: string } | null {
  const pk = process.env.GARMIN_OAUTH_CONSUMER_KEY?.trim();
  const ps = process.env.GARMIN_OAUTH_CONSUMER_SECRET?.trim();
  if (pk && ps && timingSafeStringEq(consumerKey, pk)) return { key: pk, secret: ps };
  const ok = process.env.GARMIN_OAUTH2_CLIENT_ID?.trim();
  const os = process.env.GARMIN_OAUTH2_CLIENT_SECRET?.trim();
  if (ok && os && timingSafeStringEq(consumerKey, ok)) return { key: ok, secret: os };
  return null;
}

/**
 * Verifica firma OAuth 1.0a HMAC-SHA1 (stesso schema di `oauth-1.0a` usato per il pull).
 * Token secret vuoto (richieste server Garmin → partner).
 */
function verifyOAuth1HmacSha1Signature(req: NextRequest, rawBody: string): boolean {
  const auth =
    req.headers.get("authorization")?.trim() ||
    req.headers.get("Authorization")?.trim() ||
    "";
  const parsed = parseOAuthParamsFromAuthorization(auth);
  if (!parsed?.oauth_consumer_key || !parsed.oauth_signature) return false;
  const method = parsed.oauth_signature_method || "HMAC-SHA1";

  const consumer = resolveConsumerForIncomingOAuth(parsed.oauth_consumer_key);
  if (!consumer) return false;

  if (parsed.oauth_body_hash) {
    const digest = createHash("sha1").update(rawBody, "utf8").digest("base64");
    if (!timingSafeStringEq(digest, parsed.oauth_body_hash)) return false;
  }

  const oauthData: Record<string, string> = { ...parsed };
  delete oauthData.oauth_signature;

  const urlString = garminPushRequestUrlForSigning(req);
  const tokenSecret = "";

  if (method === "PLAINTEXT") {
    const oauthPlain = new OAuth({
      consumer,
      signature_method: "PLAINTEXT",
      hash_function(_b: string, key: string) {
        return key;
      },
    });
    const expected = (
      oauthPlain as unknown as {
        getSignature: (r: { url: string; method: string; data: Record<string, unknown> }, ts: string, d: Record<string, string>) => string;
      }
    ).getSignature({ url: urlString, method: "POST", data: {} }, tokenSecret, oauthData);
    return timingSafeStringEq(expected, parsed.oauth_signature);
  }

  if (method !== "HMAC-SHA1") return false;

  try {
    const oauth = new OAuth({
      consumer,
      signature_method: "HMAC-SHA1",
      hash_function(baseString: string, key: string) {
        return createHmac("sha1", key).update(baseString, "utf8").digest("base64");
      },
    });
    const expected = (
      oauth as unknown as {
        getSignature: (r: { url: string; method: string; data: Record<string, unknown> }, ts: string, d: Record<string, string>) => string;
      }
    ).getSignature({ url: urlString, method: "POST", data: {} }, tokenSecret, oauthData);
    return timingSafeStringEq(expected, parsed.oauth_signature);
  } catch {
    return false;
  }
}

/**
 * Autenticazione richieste POST push dal cloud Garmin.
 *
 * - Senza `GARMIN_PUSH_WEBHOOK_SECRET` → accetta (solo HTTPS / rate limit infra).
 * - Con secret: `?token=` / `x-empathy-garmin-secret` **oppure** `garmin-client-id` uguale a un client id noto
 *   **oppure** `Authorization: OAuth` con **firma OAuth1 valida** (HMAC-SHA1 o PLAINTEXT; tipico push portale incluso CONSUMER_PERMISSIONS).
 */
export function verifyGarminPushWebhookAuth(req: NextRequest, rawBody: string): boolean {
  const customSecret = process.env.GARMIN_PUSH_WEBHOOK_SECRET?.trim();
  if (!customSecret) return true;

  const q = req.nextUrl.searchParams.get("token")?.trim();
  if (q && timingSafeStringEq(q, customSecret)) return true;
  const h = req.headers.get("x-empathy-garmin-secret")?.trim();
  if (h && timingSafeStringEq(h, customSecret)) return true;

  const garminClientId =
    req.headers.get("garmin-client-id")?.trim() ||
    req.headers.get("Garmin-Client-Id")?.trim() ||
    req.headers.get("GARMIN-CLIENT-ID")?.trim() ||
    "";

  if (garminClientId) {
    for (const id of garminTrustedClientIds()) {
      if (timingSafeStringEq(garminClientId, id)) return true;
    }
  }

  const auth =
    req.headers.get("authorization")?.trim() ||
    req.headers.get("Authorization")?.trim() ||
    "";
  if (auth.toLowerCase().startsWith("oauth ")) {
    const ck = extractOAuthConsumerKeyFromAuthorization(auth);
    if (ck) {
      if (verifyOAuth1HmacSha1Signature(req, rawBody)) return true;
      for (const id of garminTrustedClientIds()) {
        if (timingSafeStringEq(ck, id)) return true;
      }
    }
  }

  return false;
}
