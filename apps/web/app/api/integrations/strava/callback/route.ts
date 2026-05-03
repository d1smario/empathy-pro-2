import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveGarminAppBaseUrl } from "@/lib/integrations/garmin-app-base-url";
import { isGarminOAuthBrowserNavigation } from "@/lib/integrations/garmin-authorize-ux";
import { exchangeStravaAuthorizationCode, fetchStravaAthleteId } from "@/lib/integrations/strava-oauth2-api";
import { upsertVendorOauthLink } from "@/lib/integrations/vendor-oauth-persist";
import { parseRealityCallbackState } from "@/lib/reality/provider-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function profileStravaUrl(req: NextRequest, code: string, detail?: string): URL {
  const u = new URL("/profile", resolveGarminAppBaseUrl(req));
  u.searchParams.set("strava", code);
  if (detail) u.searchParams.set("detail", detail.slice(0, 500));
  return u;
}

/**
 * Callback OAuth2 Strava → salva token in `vendor_oauth_links` (service role).
 */
export async function GET(req: NextRequest) {
  const browserNav = isGarminOAuthBrowserNavigation(req);
  const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  const state = req.nextUrl.searchParams.get("state")?.trim() ?? "";
  const oauthError = req.nextUrl.searchParams.get("error")?.trim() ?? "";
  const athleteId = parseRealityCallbackState(state).athleteId?.trim() ?? "";

  const redirectErr = (reason: string, detailSnippet?: string) => {
    const u = profileStravaUrl(req, "error", detailSnippet ?? reason);
    u.searchParams.set("reason", reason.slice(0, 400));
    return NextResponse.redirect(u.toString(), 302);
  };

  if (oauthError) {
    if (browserNav) return redirectErr(oauthError);
    return NextResponse.json({ error: oauthError }, { status: 400 });
  }
  if (!code || !athleteId) {
    if (browserNav) return redirectErr("missing_code_or_state");
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  try {
    await requireAthleteReadContext(req, athleteId);
  } catch (e) {
    if (e instanceof AthleteReadContextError && e.status === 401) {
      const resume = `${req.nextUrl.pathname}${req.nextUrl.search}`;
      const u = new URL("/access", resolveGarminAppBaseUrl(req));
      u.searchParams.set("next", resume);
      return NextResponse.redirect(u.toString(), 302);
    }
    if (e instanceof AthleteReadContextError) {
      if (browserNav) return redirectErr(e.message);
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const tok = await exchangeStravaAuthorizationCode({ code });
  if ("error" in tok) {
    if (browserNav) return redirectErr("token_exchange", tok.error);
    return NextResponse.json({ error: tok.error }, { status: 502 });
  }

  let external =
    tok.athlete_id != null && Number.isFinite(tok.athlete_id) ? String(Math.trunc(tok.athlete_id)) : null;
  if (!external) {
    external = await fetchStravaAthleteId(tok.access_token);
  }

  const expiresAt =
    tok.expires_at != null && Number.isFinite(tok.expires_at)
      ? new Date(Math.max(0, tok.expires_at) * 1000)
      : tok.expires_in != null && Number.isFinite(tok.expires_in)
        ? new Date(Date.now() + Math.max(0, tok.expires_in) * 1000)
        : null;

  const persisted = await upsertVendorOauthLink({
    athleteId,
    vendor: "strava",
    externalUserId: external,
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt,
    scope: tok.scope,
  });

  if (!persisted.ok) {
    if (browserNav) return redirectErr("persist_failed", persisted.error);
    return NextResponse.json({ error: persisted.error }, { status: 503 });
  }

  if (browserNav) {
    return NextResponse.redirect(profileStravaUrl(req, "ok").toString(), 302);
  }
  return NextResponse.json({ ok: true as const, vendor: "strava" as const });
}
