import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveGarminAppBaseUrl } from "@/lib/integrations/garmin-app-base-url";
import { isGarminOAuthBrowserNavigation } from "@/lib/integrations/garmin-authorize-ux";
import { POLAR_DEFAULT_SCOPE, polarAuthorizeUrl } from "@/lib/integrations/polar-oauth2-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function profilePolarUrl(req: NextRequest, code: string, detail?: string): URL {
  const u = new URL("/profile", resolveGarminAppBaseUrl(req));
  u.searchParams.set("polar", code);
  if (detail) u.searchParams.set("detail", detail.slice(0, 500));
  return u;
}

/**
 * Avvio OAuth2 Polar AccessLink. Query: `athleteId` (uuid).
 * Env: `POLAR_OAUTH2_CLIENT_ID`, opz. `POLAR_OAUTH2_REDIRECT_URI`, `POLAR_OAUTH2_AUTHORIZE_URL`, `POLAR_OAUTH2_SCOPES`.
 * Nota Polar: `redirect_uri` è opzionale; se non passato usa quello di default del client nell'admin.
 */
export async function GET(req: NextRequest) {
  const browserNav = isGarminOAuthBrowserNavigation(req);
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId) {
    if (browserNav) return NextResponse.redirect(profilePolarUrl(req, "missing_athlete"), 302);
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
      if (browserNav) return NextResponse.redirect(profilePolarUrl(req, "denied", e.message), 302);
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const clientId = process.env.POLAR_OAUTH2_CLIENT_ID?.trim();
  if (!clientId) {
    if (browserNav) return NextResponse.redirect(profilePolarUrl(req, "server_config"), 302);
    return NextResponse.json({ error: "Polar OAuth2 non configurato (POLAR_OAUTH2_CLIENT_ID)." }, { status: 503 });
  }

  const authorize = new URL(polarAuthorizeUrl());
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("scope", process.env.POLAR_OAUTH2_SCOPES?.trim() || POLAR_DEFAULT_SCOPE);
  authorize.searchParams.set("state", athleteId);
  const redirectUri = process.env.POLAR_OAUTH2_REDIRECT_URI?.trim();
  if (redirectUri) authorize.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(authorize.toString(), 302);
}
