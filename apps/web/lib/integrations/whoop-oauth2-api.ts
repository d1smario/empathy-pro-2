import "server-only";

const WHOOP_TOKEN_URL_DEFAULT = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_PROFILE_URL_DEFAULT = "https://api.prod.whoop.com/v2/user/profile/basic";

export function whoopApiBaseUrl(): string {
  return process.env.WHOOP_API_BASE_URL?.trim().replace(/\/$/, "") || "https://api.prod.whoop.com";
}

/**
 * Path collection API v2 (base URL: `whoopApiBaseUrl()`).
 * @see https://developer.whoop.com/docs/developing/v1-v2-migration/
 */
export const WHOOP_V2_COLLECTION_PATHS = {
  sleep: "/v2/activity/sleep",
  recovery: "/v2/recovery",
  workout: "/v2/activity/workout",
} as const;

function whoopTokenUrl(): string {
  return process.env.WHOOP_OAUTH2_TOKEN_URL?.trim() || WHOOP_TOKEN_URL_DEFAULT;
}

function whoopProfileUrl(): string {
  return process.env.WHOOP_API_PROFILE_URL?.trim() || WHOOP_PROFILE_URL_DEFAULT;
}

export async function exchangeWhoopAuthorizationCode(input: {
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
  const clientId = process.env.WHOOP_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.WHOOP_OAUTH2_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { error: "WHOOP_OAUTH2_CLIENT_ID / WHOOP_OAUTH2_CLIENT_SECRET non configurati." };
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(whoopTokenUrl(), {
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
    return { error: `whoop_token_non_json:${res.status}:${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    return { error: `whoop_token_http_${res.status}:${String(json.error ?? text).slice(0, 300)}` };
  }
  const access = json.access_token;
  if (typeof access !== "string" || !access.trim()) {
    return { error: "whoop_token_missing_access_token" };
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

export async function exchangeWhoopRefreshToken(refreshToken: string): Promise<
  | {
      access_token: string;
      refresh_token: string | null;
      expires_in: number | null;
      scope: string | null;
    }
  | { error: string }
> {
  const clientId = process.env.WHOOP_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.WHOOP_OAUTH2_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { error: "WHOOP_OAUTH2_CLIENT_ID / WHOOP_OAUTH2_CLIENT_SECRET non configurati." };
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(whoopTokenUrl(), {
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
    return { error: `whoop_refresh_non_json:${res.status}:${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    return { error: `whoop_refresh_http_${res.status}:${String(json.error ?? text).slice(0, 300)}` };
  }
  const access = json.access_token;
  if (typeof access !== "string" || !access.trim()) {
    return { error: "whoop_refresh_missing_access_token" };
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

export async function fetchWhoopUserId(accessToken: string): Promise<string | null> {
  const res = await fetch(whoopProfileUrl(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as Record<string, unknown>;
  const id =
    typeof j.user_id === "string"
      ? j.user_id
      : typeof j.userId === "string"
        ? j.userId
        : typeof j.id === "string"
          ? j.id
          : null;
  return id?.trim() || null;
}
