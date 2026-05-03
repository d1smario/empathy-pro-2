import "server-only";

const WAHOO_TOKEN_URL_DEFAULT = "https://api.wahooligan.com/oauth/token";
const WAHOO_USER_URL_DEFAULT = "https://api.wahooligan.com/v1/user";

export function wahooApiBaseUrl(): string {
  return process.env.WAHOO_API_BASE_URL?.trim().replace(/\/$/, "") || "https://api.wahooligan.com";
}

function wahooTokenUrl(): string {
  return process.env.WAHOO_OAUTH2_TOKEN_URL?.trim() || WAHOO_TOKEN_URL_DEFAULT;
}

function wahooUserUrl(): string {
  return process.env.WAHOO_API_USER_URL?.trim() || WAHOO_USER_URL_DEFAULT;
}

export async function exchangeWahooAuthorizationCode(input: {
  code: string;
  redirectUri: string;
}): Promise<
  | {
      access_token: string;
      refresh_token: string | null;
      expires_in: number | null;
      scope: string | null;
    }
  | { error: string }
> {
  const clientId = process.env.WAHOO_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.WAHOO_OAUTH2_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { error: "WAHOO_OAUTH2_CLIENT_ID / WAHOO_OAUTH2_CLIENT_SECRET non configurati." };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(wahooTokenUrl(), {
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
    return { error: `wahoo_token_non_json:${res.status}:${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    return { error: `wahoo_token_http_${res.status}:${String(json.error ?? text).slice(0, 300)}` };
  }
  const access = json.access_token;
  if (typeof access !== "string" || !access.trim()) {
    return { error: "wahoo_token_missing_access_token" };
  }
  const refresh = typeof json.refresh_token === "string" ? json.refresh_token : null;
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : null;
  const scope = typeof json.scope === "string" ? json.scope : null;
  return {
    access_token: access.trim(),
    refresh_token: refresh,
    expires_in: expiresIn,
    scope,
  };
}

export async function exchangeWahooRefreshToken(refreshToken: string): Promise<
  | {
      access_token: string;
      refresh_token: string | null;
      expires_in: number | null;
      scope: string | null;
    }
  | { error: string }
> {
  const clientId = process.env.WAHOO_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.WAHOO_OAUTH2_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { error: "WAHOO_OAUTH2_CLIENT_ID / WAHOO_OAUTH2_CLIENT_SECRET non configurati." };
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(wahooTokenUrl(), {
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
    return { error: `wahoo_refresh_non_json:${res.status}:${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    return { error: `wahoo_refresh_http_${res.status}:${String(json.error ?? text).slice(0, 300)}` };
  }
  const access = json.access_token;
  if (typeof access !== "string" || !access.trim()) {
    return { error: "wahoo_refresh_missing_access_token" };
  }
  const refresh = typeof json.refresh_token === "string" ? json.refresh_token : refreshToken;
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : null;
  const scope = typeof json.scope === "string" ? json.scope : null;
  return {
    access_token: access.trim(),
    refresh_token: refresh,
    expires_in: expiresIn,
    scope,
  };
}

export async function fetchWahooUserId(accessToken: string): Promise<string | null> {
  const res = await fetch(wahooUserUrl(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as Record<string, unknown>;
  const id = typeof j.id === "number" ? String(j.id) : typeof j.id === "string" ? j.id : null;
  return id?.trim() || null;
}
