import { createHmac, timingSafeEqual } from "node:crypto";

import "server-only";

export const GARMIN_PKCE_COOKIE = "empathy_garmin_pkce";

type SealedPayload = {
  v: 1;
  verifier: string;
  athleteId: string;
  exp: number;
};

function readPkceSecret(): string {
  const s = process.env.GARMIN_OAUTH_PKCE_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error("Imposta GARMIN_OAUTH_PKCE_SECRET (min 16 caratteri) per OAuth Garmin PKCE.");
  }
  return s;
}

function sign(secret: string, payloadUtf8: string): string {
  return createHmac("sha256", secret).update(payloadUtf8).digest("base64url");
}

/** Cookie value: base64url(json).sig */
export function sealGarminPkceCookie(payload: Omit<SealedPayload, "v" | "exp"> & { ttlSeconds?: number }): string {
  const secret = readPkceSecret();
  const body: SealedPayload = {
    v: 1,
    verifier: payload.verifier,
    athleteId: payload.athleteId,
    exp: Math.floor(Date.now() / 1000) + (payload.ttlSeconds ?? 600),
  };
  const json = JSON.stringify(body);
  const sig = sign(secret, json);
  return `${Buffer.from(json, "utf8").toString("base64url")}.${sig}`;
}

export function unsealGarminPkceCookie(raw: string): SealedPayload | null {
  const secret = readPkceSecret();
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const b64 = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  let json: string;
  try {
    json = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(secret, json);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  let parsed: SealedPayload;
  try {
    parsed = JSON.parse(json) as SealedPayload;
  } catch {
    return null;
  }
  if (parsed.v !== 1 || typeof parsed.verifier !== "string" || typeof parsed.athleteId !== "string") return null;
  if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return parsed;
}
