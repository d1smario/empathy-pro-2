import "server-only";

const TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const USER_ID_URL = "https://apis.garmin.com/wellness-api/rest/user/id";

export type GarminTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

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
  const access = json.access_token;
  const refresh = json.refresh_token;
  const expiresIn = json.expires_in;
  if (typeof access !== "string" || typeof refresh !== "string" || typeof expiresIn !== "number") {
    throw new Error("Risposta token Garmin inattesa (access_token / refresh_token / expires_in).");
  }
  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: expiresIn,
    scope: typeof json.scope === "string" ? json.scope : undefined,
    token_type: typeof json.token_type === "string" ? json.token_type : undefined,
  };
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
