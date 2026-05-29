import "server-only";

/**
 * Polar AccessLink OAuth2 + Users API.
 * @see https://www.polar.com/accesslink-api/#authentication
 *
 * Specificità rispetto a WHOOP:
 * - Token endpoint richiede Basic auth `client_id:client_secret` (non client_id nel body).
 * - L'access token NON scade salvo revoca (nessun refresh token).
 * - Dopo l'OAuth bisogna **registrare** l'utente (`POST /v3/users`) prima di leggerne i dati.
 * - `/v3/users/**` usa Bearer token utente; `/v3/notifications` userebbe client credentials.
 */

const POLAR_TOKEN_URL_DEFAULT = "https://polarremote.com/v2/oauth2/token";
const POLAR_AUTHORIZE_URL_DEFAULT = "https://flow.polar.com/oauth2/authorization";
const POLAR_API_BASE_DEFAULT = "https://www.polaraccesslink.com";
/** Unico scope AccessLink. */
export const POLAR_DEFAULT_SCOPE = "accesslink.read_all";

/** Path collection v3 (base URL: `polarApiBaseUrl()`). Tutti con Bearer token utente. */
export const POLAR_V3_PATHS = {
  exercises: "/v3/exercises",
  sleep: "/v3/users/sleep",
  nightlyRecharge: "/v3/users/nightly-recharge",
} as const;

export function polarApiBaseUrl(): string {
  return process.env.POLAR_API_BASE_URL?.trim().replace(/\/$/, "") || POLAR_API_BASE_DEFAULT;
}

export function polarAuthorizeUrl(): string {
  return process.env.POLAR_OAUTH2_AUTHORIZE_URL?.trim() || POLAR_AUTHORIZE_URL_DEFAULT;
}

function polarTokenUrl(): string {
  return process.env.POLAR_OAUTH2_TOKEN_URL?.trim() || POLAR_TOKEN_URL_DEFAULT;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export type PolarTokenResult =
  | { access_token: string; expires_in: number | null; x_user_id: string | null }
  | { error: string };

/** Scambia l'authorization code per un access token (Basic auth client credentials). */
export async function exchangePolarAuthorizationCode(input: {
  code: string;
  redirectUri?: string | null;
}): Promise<PolarTokenResult> {
  const clientId = process.env.POLAR_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.POLAR_OAUTH2_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { error: "POLAR_OAUTH2_CLIENT_ID / POLAR_OAUTH2_CLIENT_SECRET non configurati." };
  }

  const body = new URLSearchParams({ grant_type: "authorization_code", code: input.code });
  if (input.redirectUri) body.set("redirect_uri", input.redirectUri);

  const res = await fetch(polarTokenUrl(), {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json;charset=UTF-8",
    },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: `polar_token_non_json:${res.status}:${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    return { error: `polar_token_http_${res.status}:${String(json.error ?? text).slice(0, 300)}` };
  }
  const access = json.access_token;
  if (typeof access !== "string" || !access.trim()) {
    return { error: "polar_token_missing_access_token" };
  }
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : null;
  const xUserId =
    typeof json.x_user_id === "number"
      ? String(json.x_user_id)
      : typeof json.x_user_id === "string"
        ? json.x_user_id
        : null;
  return { access_token: access.trim(), expires_in: expiresIn, x_user_id: xUserId };
}

/**
 * Registra l'utente presso il client AccessLink (obbligatorio prima di leggere i dati).
 * `409` = già registrato → trattato come successo. `403` = consensi mancanti.
 */
export async function registerPolarUser(input: {
  accessToken: string;
  memberId: string;
}): Promise<{ ok: true; polarUserId: string | null; alreadyRegistered: boolean } | { error: string }> {
  const res = await fetch(`${polarApiBaseUrl()}/v3/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ "member-id": input.memberId }),
    cache: "no-store",
  });

  if (res.status === 409) {
    return { ok: true, polarUserId: null, alreadyRegistered: true };
  }
  if (res.status === 403) {
    return { error: "polar_register_consents_missing: l'utente non ha accettato tutti i consensi obbligatori." };
  }
  const text = await res.text();
  if (!res.ok) {
    return { error: `polar_register_http_${res.status}:${text.slice(0, 300)}` };
  }
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: true, polarUserId: null, alreadyRegistered: false };
  }
  const id = json["polar-user-id"];
  const polarUserId = typeof id === "number" ? String(id) : typeof id === "string" ? id : null;
  return { ok: true, polarUserId, alreadyRegistered: false };
}
