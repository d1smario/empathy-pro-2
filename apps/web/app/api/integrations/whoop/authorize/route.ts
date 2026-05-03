import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveGarminAppBaseUrl } from "@/lib/integrations/garmin-app-base-url";
import { isGarminOAuthBrowserNavigation } from "@/lib/integrations/garmin-authorize-ux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WHOOP_AUTH_DEFAULT = "https://api.prod.whoop.com/oauth/oauth2/auth";
const DEFAULT_SCOPES =
  "offline read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout";

function profileWhoopUrl(req: NextRequest, code: string, detail?: string): URL {
  const u = new URL("/profile", resolveGarminAppBaseUrl(req));
  u.searchParams.set("whoop", code);
  if (detail) u.searchParams.set("detail", detail.slice(0, 500));
  return u;
}

/**
 * Avvio OAuth2 WHOOP. Query: `athleteId` (uuid).
 * Env: `WHOOP_OAUTH2_CLIENT_ID`, `WHOOP_OAUTH2_REDIRECT_URI`, opz. `WHOOP_OAUTH2_AUTHORIZE_URL`, `WHOOP_OAUTH2_SCOPES`.
 */
export async function GET(req: NextRequest) {
  const browserNav = isGarminOAuthBrowserNavigation(req);
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId) {
    if (browserNav) return NextResponse.redirect(profileWhoopUrl(req, "missing_athlete"), 302);
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
      if (browserNav) return NextResponse.redirect(profileWhoopUrl(req, "denied", e.message), 302);
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const clientId = process.env.WHOOP_OAUTH2_CLIENT_ID?.trim();
  const redirectUri = process.env.WHOOP_OAUTH2_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    if (browserNav) return NextResponse.redirect(profileWhoopUrl(req, "server_config"), 302);
    return NextResponse.json(
      { error: "WHOOP OAuth2 non configurato (WHOOP_OAUTH2_CLIENT_ID / WHOOP_OAUTH2_REDIRECT_URI)." },
      { status: 503 },
    );
  }

  const base = process.env.WHOOP_OAUTH2_AUTHORIZE_URL?.trim() || WHOOP_AUTH_DEFAULT;
  const authorize = new URL(base);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", process.env.WHOOP_OAUTH2_SCOPES?.trim() || DEFAULT_SCOPES);
  authorize.searchParams.set("state", athleteId);

  return NextResponse.redirect(authorize.toString(), 302);
}
