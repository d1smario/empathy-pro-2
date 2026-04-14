import "server-only";

import { createHmac } from "node:crypto";

import OAuth from "oauth-1.0a";

/**
 * Consumer OAuth 1.0a per firmare le GET pull verso Garmin.
 * Preferisce `GARMIN_OAUTH_CONSUMER_*`; se assenti, usa la stessa coppia OAuth2 del portale (`GARMIN_OAUTH2_*`).
 */
export function readGarminOAuthConsumer(): { key: string; secret: string } | null {
  const key = process.env.GARMIN_OAUTH_CONSUMER_KEY?.trim() || process.env.GARMIN_OAUTH2_CLIENT_ID?.trim();
  const secret =
    process.env.GARMIN_OAUTH_CONSUMER_SECRET?.trim() || process.env.GARMIN_OAUTH2_CLIENT_SECRET?.trim();
  if (!key || !secret) return null;
  return { key, secret };
}

/** Spesso vuoto; se Garmin fornisce token secret al link utente, impostalo qui. */
export function readGarminUserTokenSecret(): string {
  return process.env.GARMIN_OAUTH_USER_TOKEN_SECRET?.trim() ?? "";
}

/**
 * Header `Authorization` OAuth 1.0a (HMAC-SHA1) per GET verso `callbackURL` della push.
 * Consumer key/secret = portale Garmin (API Pull Token / API Configuration).
 */
export function buildGarminSignedGetHeaders(params: { url: string; userAccessToken: string }): {
  Authorization: string;
} {
  const consumer = readGarminOAuthConsumer();
  if (!consumer) {
    throw new Error(
      "Imposta GARMIN_OAUTH_CONSUMER_KEY/SECRET oppure GARMIN_OAUTH2_CLIENT_ID/SECRET (stessa coppia del portale se Garmin le unifica).",
    );
  }

  const oauth = new OAuth({
    consumer,
    signature_method: "HMAC-SHA1",
    hash_function(baseString: string, key: string) {
      return createHmac("sha1", key).update(baseString).digest("base64");
    },
  });

  const authorized = oauth.authorize(
    { url: params.url, method: "GET" },
    { key: params.userAccessToken, secret: readGarminUserTokenSecret() },
  );

  return oauth.toHeader(authorized);
}
