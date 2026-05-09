/**
 * Verifica webhook Garmin senza `NextRequest` (Express / Node HTTP ingest con body grandi).
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

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

/** Path assoluto app (`pathname` + `search`), es. `/api/integrations/garmin/push/dailies?token=x`. */
export function garminPushSigningUrlFromIncoming(
  pathWithSearch: string,
  forwardedProto?: string | null,
  forwardedHost?: string | null,
): string {
  const explicit = process.env.GARMIN_PUSH_PUBLIC_BASE_URL?.trim();
  const p = pathWithSearch.startsWith("/") ? pathWithSearch : `/${pathWithSearch}`;
  if (explicit) {
    const base = explicit.replace(/\/$/, "");
    return `${base}${p}`;
  }
  const proto = forwardedProto?.split(",")[0]?.trim();
  const host = forwardedHost?.split(",")[0]?.trim();
  if (proto && host) {
    return `${proto}://${host}${p}`;
  }
  return p;
}

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

function verifyOAuth1HmacSha1SignaturePlain(oauthSigningUrl: string, authorizationHeader: string, rawBody: string): boolean {
  const auth = authorizationHeader.trim();
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

  const urlString = oauthSigningUrl;
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

export type GarminPushWebhookAuthPlainInput = {
  pathWithSearch: string;
  forwardedProto?: string | null;
  forwardedHost?: string | null;
  rawBody: string;
  queryToken?: string | null;
  headerGet: (name: string) => string | null | undefined;
};

/**
 * Stessa logica di `verifyGarminPushWebhookAuth` (route Next) ma senza `NextRequest`.
 */
export function verifyGarminPushWebhookAuthPlain(input: GarminPushWebhookAuthPlainInput): boolean {
  const customSecret = process.env.GARMIN_PUSH_WEBHOOK_SECRET?.trim();
  if (!customSecret) return true;

  const q = input.queryToken?.trim();
  if (q && timingSafeStringEq(q, customSecret)) return true;

  const h = input.headerGet("x-empathy-garmin-secret")?.trim();
  if (h && timingSafeStringEq(h, customSecret)) return true;

  const garminClientId =
    input.headerGet("garmin-client-id")?.trim() ||
    input.headerGet("Garmin-Client-Id")?.trim() ||
    input.headerGet("GARMIN-CLIENT-ID")?.trim() ||
    "";

  if (garminClientId) {
    for (const id of garminTrustedClientIds()) {
      if (timingSafeStringEq(garminClientId, id)) return true;
    }
  }

  const oauthSigningUrl = garminPushSigningUrlFromIncoming(
    input.pathWithSearch,
    input.forwardedProto,
    input.forwardedHost,
  );

  const auth =
    input.headerGet("authorization")?.trim() ||
    input.headerGet("Authorization")?.trim() ||
    "";
  if (auth.toLowerCase().startsWith("oauth ")) {
    const ck = extractOAuthConsumerKeyFromAuthorization(auth);
    if (ck) {
      if (verifyOAuth1HmacSha1SignaturePlain(oauthSigningUrl, auth, input.rawBody)) return true;
      for (const id of garminTrustedClientIds()) {
        if (timingSafeStringEq(ck, id)) return true;
      }
    }
  }

  return false;
}
