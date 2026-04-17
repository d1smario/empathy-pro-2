import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { exchangeGarminRefreshToken } from "@/lib/integrations/garmin-oauth2-api";

const ACCESS_SKEW_MS = 5 * 60 * 1000;

type LinkRow = {
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  token_expires_at: string | null;
};

function readOAuth2Env(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GARMIN_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.GARMIN_OAUTH2_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function tokenExpiresAtMs(row: LinkRow): number {
  if (!row.token_expires_at) return 0;
  const t = new Date(row.token_expires_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Access token OAuth2 valido per chiamate wellness (refresh se vicino a scadenza).
 * Richiede client Supabase con accesso in scrittura a `garmin_athlete_links` (service role in pull/disconnect).
 */
export async function ensureFreshGarminAccessTokenForAthlete(
  supabase: SupabaseClient,
  athleteId: string,
): Promise<{ accessToken: string } | { error: string }> {
  const env = readOAuth2Env();
  if (!env) return { error: "oauth2_env_missing" };

  const { data: row, error } = await supabase
    .from("garmin_athlete_links")
    .select("oauth_access_token, oauth_refresh_token, token_expires_at")
    .eq("athlete_id", athleteId)
    .maybeSingle();

  if (error) return { error: error.message };
  const link = row as LinkRow | null;
  if (!link?.oauth_refresh_token?.trim()) return { error: "no_garmin_link" };

  const expMs = tokenExpiresAtMs(link);
  const access = link.oauth_access_token?.trim() ?? "";
  if (access && expMs > Date.now() + ACCESS_SKEW_MS) {
    return { accessToken: access };
  }

  try {
    const tokens = await exchangeGarminRefreshToken({
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      refreshToken: link.oauth_refresh_token.trim(),
    });
    const expiresAt = new Date(Date.now() + Math.max(60, tokens.expires_in - 600) * 1000).toISOString();
    const refreshExpiresAt =
      typeof tokens.refresh_token_expires_in === "number" && Number.isFinite(tokens.refresh_token_expires_in)
        ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
        : null;

    const { error: upErr } = await supabase
      .from("garmin_athlete_links")
      .update({
        oauth_access_token: tokens.access_token,
        oauth_refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        oauth_refresh_expires_at: refreshExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("athlete_id", athleteId);

    if (upErr) return { error: upErr.message };
    return { accessToken: tokens.access_token };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh_failed";
    return { error: msg };
  }
}
