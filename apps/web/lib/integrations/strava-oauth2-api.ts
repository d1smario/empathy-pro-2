import "server-only";

const STRAVA_TOKEN_URL_DEFAULT = "https://www.strava.com/oauth/token";
const STRAVA_ATHLETE_URL_DEFAULT = "https://www.strava.com/api/v3/athlete";

function stravaTokenUrl(): string {
  return process.env.STRAVA_OAUTH2_TOKEN_URL?.trim() || STRAVA_TOKEN_URL_DEFAULT;
}

function stravaAthleteUrl(): string {
  return process.env.STRAVA_API_ATHLETE_URL?.trim() || STRAVA_ATHLETE_URL_DEFAULT;
}

export async function exchangeStravaAuthorizationCode(input: {
  code: string;
}): Promise<
  | {
      access_token: string;
      refresh_token: string | null;
      expires_at: number | null;
      expires_in: number | null;
      scope: string | null;
      athlete_id: number | null;
    }
  | { error: string }
> {
  const clientId = process.env.STRAVA_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_OAUTH2_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { error: "STRAVA_OAUTH2_CLIENT_ID / STRAVA_OAUTH2_CLIENT_SECRET non configurati." };
  }

  const redirectUri = process.env.STRAVA_OAUTH2_REDIRECT_URI?.trim();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: input.code,
    grant_type: "authorization_code",
  });
  if (redirectUri) body.set("redirect_uri", redirectUri);

  const res = await fetch(stravaTokenUrl(), {
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
    return { error: `strava_token_non_json:${res.status}:${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    const msg = typeof json.message === "string" ? json.message : String(json.errors ?? text).slice(0, 400);
    return { error: `strava_token_http_${res.status}:${msg}` };
  }
  const access = json.access_token;
  if (typeof access !== "string" || !access.trim()) {
    return { error: "strava_token_missing_access_token" };
  }
  const refresh = typeof json.refresh_token === "string" ? json.refresh_token : null;
  const expiresAt = typeof json.expires_at === "number" && Number.isFinite(json.expires_at) ? json.expires_at : null;
  const expiresIn = typeof json.expires_in === "number" && Number.isFinite(json.expires_in) ? json.expires_in : null;
  const scope = typeof json.scope === "string" ? json.scope : null;
  let athleteId: number | null = null;
  const athlete = json.athlete;
  if (athlete && typeof athlete === "object" && !Array.isArray(athlete)) {
    const id = (athlete as Record<string, unknown>).id;
    if (typeof id === "number" && Number.isFinite(id)) athleteId = Math.trunc(id);
  }
  return {
    access_token: access.trim(),
    refresh_token: refresh,
    expires_at: expiresAt,
    expires_in: expiresIn,
    scope,
    athlete_id: athleteId,
  };
}

export async function exchangeStravaRefreshToken(input: {
  refreshToken: string;
}): Promise<
  | {
      access_token: string;
      refresh_token: string | null;
      expires_at: number | null;
      expires_in: number | null;
      scope: string | null;
      athlete_id: number | null;
    }
  | { error: string }
> {
  const clientId = process.env.STRAVA_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_OAUTH2_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { error: "STRAVA_OAUTH2_CLIENT_ID / STRAVA_OAUTH2_CLIENT_SECRET non configurati." };
  }
  const refreshToken = input.refreshToken.trim();
  if (!refreshToken) {
    return { error: "strava_refresh_missing_refresh_token" };
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(stravaTokenUrl(), {
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
    return { error: `strava_refresh_non_json:${res.status}:${text.slice(0, 200)}` };
  }
  if (!res.ok) {
    const msg = typeof json.message === "string" ? json.message : String(json.errors ?? text).slice(0, 400);
    return { error: `strava_refresh_http_${res.status}:${msg}` };
  }
  const access = json.access_token;
  if (typeof access !== "string" || !access.trim()) {
    return { error: "strava_refresh_missing_access_token" };
  }
  const refresh = typeof json.refresh_token === "string" ? json.refresh_token : null;
  const expiresAt = typeof json.expires_at === "number" && Number.isFinite(json.expires_at) ? json.expires_at : null;
  const expiresIn = typeof json.expires_in === "number" && Number.isFinite(json.expires_in) ? json.expires_in : null;
  const scope = typeof json.scope === "string" ? json.scope : null;
  let athleteId: number | null = null;
  const athlete = json.athlete;
  if (athlete && typeof athlete === "object" && !Array.isArray(athlete)) {
    const id = (athlete as Record<string, unknown>).id;
    if (typeof id === "number" && Number.isFinite(id)) athleteId = Math.trunc(id);
  }
  return {
    access_token: access.trim(),
    refresh_token: refresh,
    expires_at: expiresAt,
    expires_in: expiresIn,
    scope,
    athlete_id: athleteId,
  };
}

/** Fallback se il token exchange non include `athlete.id`. */
export async function fetchStravaAthleteId(accessToken: string): Promise<string | null> {
  const res = await fetch(stravaAthleteUrl(), {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return null;
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const id = json.id;
    if (typeof id === "number" && Number.isFinite(id)) return String(Math.trunc(id));
  } catch {
    return null;
  }
  return null;
}
