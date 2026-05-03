import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveGarminAppBaseUrl } from "@/lib/integrations/garmin-app-base-url";
import { isGarminOAuthBrowserNavigation } from "@/lib/integrations/garmin-authorize-ux";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WAHOO_AUTH_DEFAULT = "https://api.wahooligan.com/oauth/authorize";
/** Piani + workout (lettura/scrittura) per Cloud API; `offline_data` per refresh stabile. */
const DEFAULT_SCOPES = "user_read offline_data plans_read plans_write workouts_read workouts_write";

function profileWahooUrl(req: NextRequest, code: string, detail?: string): URL {
  const u = new URL("/profile", resolveGarminAppBaseUrl(req));
  u.searchParams.set("wahoo", code);
  if (detail) u.searchParams.set("detail", detail.slice(0, 500));
  return u;
}

/**
 * Avvio OAuth2 Wahoo Cloud. Query: `athleteId` (uuid).
 * Env: `WAHOO_OAUTH2_CLIENT_ID`, `WAHOO_OAUTH2_REDIRECT_URI`, opz. `WAHOO_OAUTH2_AUTHORIZE_URL`, `WAHOO_OAUTH2_SCOPES`.
 */
export async function GET(req: NextRequest) {
  const browserNav = isGarminOAuthBrowserNavigation(req);
  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId) {
    if (browserNav) return NextResponse.redirect(profileWahooUrl(req, "missing_athlete"), 302);
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
      if (browserNav) return NextResponse.redirect(profileWahooUrl(req, "denied", e.message), 302);
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const clientId = process.env.WAHOO_OAUTH2_CLIENT_ID?.trim();
  const redirectUri = process.env.WAHOO_OAUTH2_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    if (browserNav) return NextResponse.redirect(profileWahooUrl(req, "server_config"), 302);
    return NextResponse.json(
      { error: "Wahoo OAuth2 non configurato (WAHOO_OAUTH2_CLIENT_ID / WAHOO_OAUTH2_REDIRECT_URI)." },
      { status: 503 },
    );
  }

  const base = process.env.WAHOO_OAUTH2_AUTHORIZE_URL?.trim() || WAHOO_AUTH_DEFAULT;
  const authorize = new URL(base);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", process.env.WAHOO_OAUTH2_SCOPES?.trim() || DEFAULT_SCOPES);
  authorize.searchParams.set("state", athleteId);

  return NextResponse.redirect(authorize.toString(), 302);
}
