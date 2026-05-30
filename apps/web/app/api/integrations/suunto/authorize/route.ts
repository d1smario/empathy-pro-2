import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveGarminAppBaseUrl } from "@/lib/integrations/garmin-app-base-url";
import { isGarminOAuthBrowserNavigation } from "@/lib/integrations/garmin-authorize-ux";
import { suuntoAuthorizeUrl } from "@/lib/integrations/suunto-oauth2-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function profileUrl(req: NextRequest, code: string, detail?: string): URL {
  const u = new URL("/profile", resolveGarminAppBaseUrl(req));
  u.searchParams.set("suunto", code);
  if (detail) u.searchParams.set("detail", detail.slice(0, 500));
  return u;
}

/**
 * Avvio OAuth2 Suunto. Query: `athleteId` (uuid).
 * Env: `SUUNTO_OAUTH2_CLIENT_ID`, `SUUNTO_OAUTH2_REDIRECT_URI`, opz. `SUUNTO_OAUTH2_AUTHORIZE_URL`.
 */
export async function GET(req: NextRequest) {
  const browserNav = isGarminOAuthBrowserNavigation(req);
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId) {
    if (browserNav) return NextResponse.redirect(profileUrl(req, "missing_athlete"), 302);
    return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
  }

  try {
    await requireAthleteReadContext(req, athleteId);
  } catch (e) {
    if (e instanceof AthleteReadContextError && e.status === 401) {
      const u = new URL("/access", resolveGarminAppBaseUrl(req));
      u.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
      return NextResponse.redirect(u.toString(), 302);
    }
    if (e instanceof AthleteReadContextError) {
      if (browserNav) return NextResponse.redirect(profileUrl(req, "denied", e.message), 302);
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const clientId = process.env.SUUNTO_OAUTH2_CLIENT_ID?.trim();
  const redirectUri = process.env.SUUNTO_OAUTH2_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    if (browserNav) return NextResponse.redirect(profileUrl(req, "server_config"), 302);
    return NextResponse.json(
      { error: "Suunto OAuth2 non configurato (SUUNTO_OAUTH2_CLIENT_ID / SUUNTO_OAUTH2_REDIRECT_URI)." },
      { status: 503 },
    );
  }

  const authorize = new URL(suuntoAuthorizeUrl());
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("state", athleteId);

  return NextResponse.redirect(authorize.toString(), 302);
}
