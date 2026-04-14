import { type NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { isGarminOAuthBrowserNavigation } from "@/lib/integrations/garmin-authorize-ux";
import { createGarminPkceVerifier, garminPkceChallengeS256 } from "@/lib/integrations/garmin-pkce";
import { GARMIN_PKCE_COOKIE, sealGarminPkceCookie } from "@/lib/integrations/garmin-pkce-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function profileGarminUrl(req: NextRequest, code: string, detail?: string): URL {
  const u = new URL("/profile", req.url);
  u.searchParams.set("garmin", code);
  if (detail) u.searchParams.set("detail", detail.slice(0, 500));
  return u;
}

function accessNextUrl(req: NextRequest, nextPath: string): URL {
  const u = new URL("/access", req.url);
  u.searchParams.set("next", nextPath);
  u.searchParams.set("garmin", "resume");
  return u;
}

/**
 * Avvia OAuth2 PKCE Garmin: redirect a connect.garmin.com. Richiede sessione + accesso all’atleta.
 * Query: athleteId (uuid).
 *
 * In caso di errore, se la richiesta è una navigazione browser (link), reindirizza a /profile o /access
 * con query leggibili — così non si vede una pagina JSON “vuota”.
 */
export async function GET(req: NextRequest) {
  const browserNav = isGarminOAuthBrowserNavigation(req);

  const athleteId = req.nextUrl.searchParams.get("athleteId")?.trim() ?? "";
  if (!athleteId) {
    if (browserNav) {
      return NextResponse.redirect(profileGarminUrl(req, "missing_athlete"), 302);
    }
    return NextResponse.json({ error: "Missing athleteId" }, { status: 400 });
  }

  try {
    await requireAthleteReadContext(req, athleteId);

    const clientId = process.env.GARMIN_OAUTH2_CLIENT_ID?.trim();
    const redirectUri =
      process.env.GARMIN_OAUTH2_REDIRECT_URI?.trim() || process.env.GARMIN_OAUTH2_REDIRECT_URL?.trim();
    if (!clientId || !redirectUri) {
      if (browserNav) {
        return NextResponse.redirect(profileGarminUrl(req, "server_config"), 302);
      }
      return NextResponse.json(
        { error: "Garmin OAuth2 non configurato (GARMIN_OAUTH2_CLIENT_ID / GARMIN_OAUTH2_REDIRECT_URI)." },
        { status: 503 },
      );
    }

    let verifier: string;
    let cookieVal: string;
    try {
      verifier = createGarminPkceVerifier();
      cookieVal = sealGarminPkceCookie({ verifier, athleteId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "pkce_seal_failed";
      if (browserNav) {
        return NextResponse.redirect(profileGarminUrl(req, "pkce", msg), 302);
      }
      return NextResponse.json({ error: msg }, { status: 503 });
    }

    const challenge = garminPkceChallengeS256(verifier);
    const state = JSON.stringify({
      athleteId,
      provider: "garmin",
      domain: "device",
      sourceKind: "api_sync",
    });

    const authorize = new URL("https://connect.garmin.com/oauth2Confirm");
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("state", state);

    const res = NextResponse.redirect(authorize.toString(), 302);
    res.cookies.set(GARMIN_PKCE_COOKIE, cookieVal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  } catch (e) {
    if (e instanceof AthleteReadContextError) {
      if (browserNav && e.status === 401) {
        const resume = `/api/integrations/garmin/authorize?athleteId=${encodeURIComponent(athleteId)}`;
        return NextResponse.redirect(accessNextUrl(req, resume), 302);
      }
      if (browserNav && e.status === 403) {
        return NextResponse.redirect(profileGarminUrl(req, "forbidden"), 302);
      }
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
