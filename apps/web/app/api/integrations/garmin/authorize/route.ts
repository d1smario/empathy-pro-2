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
 * Superficie authorize effettiva lato Garmin (Connect).
 * Verificato con `curl -I "https://connect.garmin.com/oauth2Confirm?...PKCE..."`:
 * Garmin risponde **302** con `Location: https://connect.garmin.com/partner/oauth2Confirm?` + stessi query.
 * Default = partner per allinearsi a quel redirect (un hop in meno; stessa semantica del PDF che cita oauth2Confirm come ingresso).
 */
const GARMIN_OAUTH2_AUTHORIZE_FALLBACK = "https://connect.garmin.com/partner/oauth2Confirm";

/**
 * Base authorize Garmin: da env solo origin + pathname (mai query/hash).
 * Evita copia-incolla da browser su Vercel con query tipo `permissionsUpdated` / `selectedCapabilities` (non le aggiungiamo noi; Garmin le può appendere dopo login).
 */
function garminOAuth2AuthorizeBaseFromEnv(): string {
  const raw = process.env.GARMIN_OAUTH2_AUTHORIZE_URL?.trim();
  if (!raw) return GARMIN_OAUTH2_AUTHORIZE_FALLBACK;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (!host.endsWith("garmin.com")) return GARMIN_OAUTH2_AUTHORIZE_FALLBACK;
    const path = u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
    return `${u.origin}${path}`;
  } catch {
    return GARMIN_OAUTH2_AUTHORIZE_FALLBACK;
  }
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

    const pkceMaxAgeSeconds = 1800;
    let verifier: string;
    let cookieVal: string;
    try {
      verifier = createGarminPkceVerifier();
      cookieVal = sealGarminPkceCookie({ verifier, athleteId, ttlSeconds: pkceMaxAgeSeconds });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "pkce_seal_failed";
      if (browserNav) {
        return NextResponse.redirect(profileGarminUrl(req, "pkce", msg), 302);
      }
      return NextResponse.json({ error: msg }, { status: 503 });
    }

    const challenge = garminPkceChallengeS256(verifier);
    /** Solo `athleteId`: il callback usa default `provider`/`domain`/`sourceKind` se assenti (`callback/route.ts`). */
    const state = JSON.stringify({ athleteId });

    /** Parametri PKCE solo quelli documentati; path = fallback sopra salvo `GARMIN_OAUTH2_AUTHORIZE_URL`. */
    const authorize = new URL(garminOAuth2AuthorizeBaseFromEnv());
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", redirectUri);
    authorize.searchParams.set("code_challenge", challenge);
    authorize.searchParams.set("code_challenge_method", "S256");
    authorize.searchParams.set("state", state);

    const res = NextResponse.redirect(authorize.toString(), 302);
    // Consenso Garmin può richiedere >10 min; mantieni allineati cookie browser e payload firmato.
    res.cookies.set(GARMIN_PKCE_COOKIE, cookieVal, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: pkceMaxAgeSeconds,
    });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    /** Debug: path authorize inviato da Empathy (stesso che Garmin espone dopo 302 da oauth2Confirm). */
    res.headers.set("X-Empathy-Garmin-Authorize-Base", `${authorize.origin}${authorize.pathname}`);
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
