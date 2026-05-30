import "server-only";

/**
 * Hammerhead Karoo Developer Platform OAuth2 + activities.
 * @see https://www.hammerhead.io/pages/developer-platform — OpenAPI: https://api.hammerhead.io/v1/docs/openapi.yml
 *
 * Provider reality canonico = `hammerhead`; route/env usano il brand `karoo`.
 * OAuth2 Authorization Code con refresh token. Scope tipico `activity:read`.
 *
 * Nota: gli URL dei dati (activities) sono **override-abili via env** perché vanno verificati
 * sull'OpenAPI del partner al primo test con credenziali reali.
 */

const KAROO_AUTHORIZE_URL_DEFAULT = "https://api.hammerhead.io/v1/auth/oauth/authorize";
const KAROO_TOKEN_URL_DEFAULT = "https://api.hammerhead.io/v1/auth/oauth/token";
const KAROO_API_BASE_DEFAULT = "https://api.hammerhead.io/v1";
/** Default best-effort; verificare path esatto su openapi.yml e all'occorrenza override via env. */
const KAROO_ACTIVITIES_PATH_DEFAULT = "/users/me/activities";
export const KAROO_DEFAULT_SCOPE = "activity:read";

export function karooApiBaseUrl(): string {
  return process.env.KAROO_API_BASE_URL?.trim().replace(/\/$/, "") || KAROO_API_BASE_DEFAULT;
}

export function karooActivitiesUrl(): string {
  const full = process.env.KAROO_API_ACTIVITIES_URL?.trim();
  if (full) return full;
  const path = process.env.KAROO_API_ACTIVITIES_PATH?.trim() || KAROO_ACTIVITIES_PATH_DEFAULT;
  return `${karooApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function karooAuthorizeUrl(): string {
  return process.env.KAROO_OAUTH2_AUTHORIZE_URL?.trim() || KAROO_AUTHORIZE_URL_DEFAULT;
}

function karooTokenUrl(): string {
  return process.env.KAROO_OAUTH2_TOKEN_URL?.trim() || KAROO_TOKEN_URL_DEFAULT;
}

export type KarooTokenResult =
  | { access_token: string; refresh_token: string | null; expires_in: number | null; scope: string | null }
  | { error: string };

async function requestKarooToken(extra: Record<string, string>): Promise<KarooTokenResult> {
  const clientId = process.env.KAROO_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.KAROO_OAUTH2_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { error: "KAROO_OAUTH2_CLIENT_ID / KAROO_OAUTH2_CLIENT_SECRET non configurati." };
  }
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...extra });
  const res = await fetch(karooTokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: `karoo_token_non_json:${res.status}:${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    return { error: `karoo_token_http_${res.status}:${String(json.error ?? text).slice(0, 300)}` };
  }
  const access = json.access_token;
  if (typeof access !== "string" || !access.trim()) {
    return { error: "karoo_token_missing_access_token" };
  }
  return {
    access_token: access.trim(),
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : null,
    scope: typeof json.scope === "string" ? json.scope : null,
  };
}

export async function exchangeKarooAuthorizationCode(input: {
  code: string;
  redirectUri: string;
}): Promise<KarooTokenResult> {
  return requestKarooToken({ grant_type: "authorization_code", code: input.code, redirect_uri: input.redirectUri });
}

export async function exchangeKarooRefreshToken(refreshToken: string): Promise<KarooTokenResult> {
  return requestKarooToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}
