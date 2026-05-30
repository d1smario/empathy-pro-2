import "server-only";

/**
 * Suunto Cloud API OAuth2 (Authorization Code) + integration API.
 * @see https://apizone.suunto.com/how-to-start
 *
 * Specificità:
 * - Token endpoint con **Basic auth** `client_id:client_secret`; access token è un **JWT** ~24h con `refresh_token`.
 * - Ogni richiesta a `https://cloudapi.suunto.com` richiede **due** header: `Authorization: Bearer <JWT>`
 *   e `Ocp-Apim-Subscription-Key: <SUUNTO_API_SUBSCRIPTION_KEY>` (Azure API Management).
 * - L'`external_user_id` = claim `user` del JWT (username Suunto), usato anche per le notifiche webhook.
 */

const SUUNTO_AUTHORIZE_URL_DEFAULT = "https://cloudapi-oauth.suunto.com/oauth/authorize";
const SUUNTO_TOKEN_URL_DEFAULT = "https://cloudapi-oauth.suunto.com/oauth/token";
const SUUNTO_API_BASE_DEFAULT = "https://cloudapi.suunto.com";

/** Path collection integration API (override via env per allineamento al partner program). */
export const SUUNTO_PATHS = {
  workouts: "/v2/workouts",
} as const;

export function suuntoApiBaseUrl(): string {
  return process.env.SUUNTO_API_BASE_URL?.trim().replace(/\/$/, "") || SUUNTO_API_BASE_DEFAULT;
}

export function suuntoAuthorizeUrl(): string {
  return process.env.SUUNTO_OAUTH2_AUTHORIZE_URL?.trim() || SUUNTO_AUTHORIZE_URL_DEFAULT;
}

function suuntoTokenUrl(): string {
  return process.env.SUUNTO_OAUTH2_TOKEN_URL?.trim() || SUUNTO_TOKEN_URL_DEFAULT;
}

export function suuntoSubscriptionKey(): string | null {
  return process.env.SUUNTO_API_SUBSCRIPTION_KEY?.trim() || null;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export type SuuntoTokenResult =
  | { access_token: string; refresh_token: string | null; expires_in: number | null; scope: string | null; user: string | null }
  | { error: string };

/** Estrae il claim `user` dal payload di un JWT Suunto (username). */
export function extractSuuntoUserFromJwt(jwt: string): string | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
    const u = json.user;
    return typeof u === "string" && u.trim() ? u.trim() : null;
  } catch {
    return null;
  }
}

async function requestSuuntoToken(body: URLSearchParams): Promise<SuuntoTokenResult> {
  const clientId = process.env.SUUNTO_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.SUUNTO_OAUTH2_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { error: "SUUNTO_OAUTH2_CLIENT_ID / SUUNTO_OAUTH2_CLIENT_SECRET non configurati." };
  }
  const res = await fetch(suuntoTokenUrl(), {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: `suunto_token_non_json:${res.status}:${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    return { error: `suunto_token_http_${res.status}:${String(json.error ?? text).slice(0, 300)}` };
  }
  const access = json.access_token;
  if (typeof access !== "string" || !access.trim()) {
    return { error: "suunto_token_missing_access_token" };
  }
  const accessToken = access.trim();
  return {
    access_token: accessToken,
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : null,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : null,
    scope: typeof json.scope === "string" ? json.scope : null,
    user: extractSuuntoUserFromJwt(accessToken),
  };
}

export async function exchangeSuuntoAuthorizationCode(input: {
  code: string;
  redirectUri: string;
}): Promise<SuuntoTokenResult> {
  return requestSuuntoToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  );
}

export async function exchangeSuuntoRefreshToken(refreshToken: string): Promise<SuuntoTokenResult> {
  return requestSuuntoToken(new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }));
}
