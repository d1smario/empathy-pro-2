import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveGarminAppBaseUrl } from "@/lib/integrations/garmin-app-base-url";
import { isGarminOAuthBrowserNavigation } from "@/lib/integrations/garmin-authorize-ux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRAVA_AUTH_DEFAULT = "https://www.strava.com/oauth/authorize";
/** Scope Strava separati da virgola (@see https://developers.strava.com/docs/authentication/). */
const DEFAULT_SCOPES = "read,activity:read";

function profileStravaUrl(req: NextRequest, code: string, detail?: string): URL {
  const u = new URL("/profile", resolveGarminAppBaseUrl(req));
  u.searchParams.set("strava", code);
  if (detail) u.searchParams.set("detail", detail.slice(0, 500));
  return u;
}

/**
 * Avvio OAuth2 Strava. Query: `athleteId` (uuid).
 * Env: `STRAVA_OAUTH2_CLIENT_ID`, `STRAVA_OAUTH2_REDIRECT_URI`, opz. `STRAVA_OAUTH2_AUTHORIZE_URL`, `STRAVA_OAUTH2_SCOPES`.
 */
export async function GET(req: NextRequest) {
  const browserNav = isGarminOAuthBrowserNavigation(req);
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId) {
    if (browserNav) return NextResponse.redirect(profileStravaUrl(req, "missing_athlete"), 302);
    return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
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
      if (browserNav) return NextResponse.redirect(profileStravaUrl(req, "denied", e.message), 302);
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const clientId = process.env.STRAVA_OAUTH2_CLIENT_ID?.trim();
  const redirectUri = process.env.STRAVA_OAUTH2_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    if (browserNav) return NextResponse.redirect(profileStravaUrl(req, "server_config"), 302);
    return NextResponse.json(
      { error: "Strava OAuth2 non configurato (STRAVA_OAUTH2_CLIENT_ID / STRAVA_OAUTH2_REDIRECT_URI)." },
      { status: 503 },
    );
  }

  const base = process.env.STRAVA_OAUTH2_AUTHORIZE_URL?.trim() || STRAVA_AUTH_DEFAULT;
  const authorize = new URL(base);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("approval_prompt", "force");
  authorize.searchParams.set("scope", process.env.STRAVA_OAUTH2_SCOPES?.trim() || DEFAULT_SCOPES);
  authorize.searchParams.set("state", athleteId);

  return NextResponse.redirect(authorize.toString(), 302);
}
