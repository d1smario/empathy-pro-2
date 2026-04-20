import "server-only";

import { GARMIN_WELLNESS_USER_REST_PATHS, garminWellnessAbsoluteUrl } from "@/lib/integrations/garmin-wellness-api";

const TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const USER_ID_URL = garminWellnessAbsoluteUrl(GARMIN_WELLNESS_USER_REST_PATHS.id);
const USER_PERMISSIONS_URL = garminWellnessAbsoluteUrl(GARMIN_WELLNESS_USER_REST_PATHS.permissions);
const USER_REGISTRATION_URL = garminWellnessAbsoluteUrl(GARMIN_WELLNESS_USER_REST_PATHS.registration);

export type GarminTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  /** Secondi fino alla scadenza del refresh token (Garmin; tipicamente ~3 mesi). */
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
};

function parseTokenJson(json: Record<string, unknown>): GarminTokenResponse {
  const access = json.access_token;
  const refresh = json.refresh_token;
  const expiresIn = json.expires_in;
  if (typeof access !== "string" || typeof refresh !== "string" || typeof expiresIn !== "number") {
    throw new Error("Risposta token Garmin inattesa (access_token / refresh_token / expires_in).");
  }
  const rtExp = json.refresh_token_expires_in;
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: expiresIn,
    refresh_token_expires_in:
      typeof rtExp === "number" && Number.isFinite(rtExp) ? Math.floor(rtExp) : undefined,
    scope: typeof json.scope === "string" ? json.scope : undefined,
    token_type: typeof json.token_type === "string" ? json.token_type : undefined,
  };
}

export async function exchangeGarminAuthorizationCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri?: string;
}): Promise<GarminTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    code_verifier: params.codeVerifier,
  });
  if (params.redirectUri) {
    body.set("redirect_uri", params.redirectUri);
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Garmin token exchange HTTP ${res.status}: ${text.slice(0, 800)}`);
  }
  const json = JSON.parse(text) as Record<string, unknown>;
  return parseTokenJson(json);
}

export async function exchangeGarminRefreshToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<GarminTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Garmin refresh token HTTP ${res.status}: ${text.slice(0, 800)}`);
  }
  const json = JSON.parse(text) as Record<string, unknown>;
  return parseTokenJson(json);
}

/**
 * DELETE partner registration (revoca consenso lato Garmin).
 * Chiamare quando l’utente scollega dal prodotto (Health API spec).
 */
export async function deleteGarminUserRegistration(accessToken: string): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(USER_REGISTRATION_URL, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken.trim()}` },
    cache: "no-store",
  });
  if (res.status === 204 || res.status === 200) return { ok: true, status: res.status };
  if (res.status === 404) return { ok: true, status: res.status };
  return { ok: false, status: res.status };
}

/** GET /wellness-api/rest/user/id — Bearer access token. */
export async function fetchGarminApiUserId(accessToken: string): Promise<string> {
  const res = await fetch(USER_ID_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Garmin user id HTTP ${res.status}: ${text.slice(0, 600)}`);
  }
  const json = JSON.parse(text) as Record<string, unknown>;
  const id = json.userId ?? json.user_id;
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("Risposta Garmin user id senza userId.");
  }
  return id.trim();
}

function normalizeGarminUserPermissionsPayload(parsed: unknown): string[] | null {
  if (Array.isArray(parsed)) {
    const strings = parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    return strings.length ? strings : null;
  }
  if (parsed && typeof parsed === "object") {
    for (const v of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        const strings = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        if (strings.length) return strings;
      }
    }
  }
  return null;
}

/**
 * GET /wellness-api/rest/user/permissions — permessi **effettivamente concessi** dall’utente (Bearer).
 * Garmin non espone un elenco “negati”; si confronta con quanto offerto dal programma in portale.
 * In caso di errore HTTP / JSON non atteso → `null` (non bloccare il link OAuth).
 */
export async function fetchGarminUserPermissions(accessToken: string): Promise<string[] | null> {
  const res = await fetch(USER_PERMISSIONS_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text) as unknown;
    return normalizeGarminUserPermissionsPayload(parsed);
  } catch {
    return null;
  }
}
