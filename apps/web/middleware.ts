import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  EMPATHY_DESKTOP_COOKIE,
  EMPATHY_MOBILE_COOKIE,
  isMobileAppPath,
  toMobilePath,
  isMobileRedirectSourcePath,
} from "@/core/navigation/mobile-module-registry";
import { isAnonymousAllowedPath, isProtectedProductShellPath } from "@/core/routing/guards";
import { isSiteIndexingDisabled } from "@/lib/site-url";
import { isMobileClientRequest } from "@/lib/shell/mobile-detect";
import { forwardMiddlewareCookies, updateSupabaseSession } from "@/lib/supabase/update-session";

const MOBILE_PREF_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function applyMobilePreferenceCookies(response: NextResponse) {
  response.cookies.set(EMPATHY_MOBILE_COOKIE, "1", {
    path: "/",
    maxAge: MOBILE_PREF_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  response.cookies.set(EMPATHY_DESKTOP_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
}

/** `?app=1` — forza shell mobile e rimuove opt-out desktop. */
function redirectForMobileAppQuery(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
): NextResponse | null {
  if (request.nextUrl.searchParams.get("app") !== "1") return null;

  const mobilePath = isMobileAppPath(pathname) ? pathname : (toMobilePath(pathname) ?? "/m/dashboard");
  const dest = new URL(mobilePath, request.url);
  dest.search = request.nextUrl.search;
  dest.searchParams.delete("app");

  const out = NextResponse.redirect(dest);
  applyMobilePreferenceCookies(out);
  forwardMiddlewareCookies(response, out);
  return out;
}

/**
 * Supabase: refresh session cookie quando env pubblico è configurato.
 * Con Supabase configurato: le route shell prodotto richiedono sessione → `/access?next=…` (no loop: access è anonima).
 * Senza env pubblico: nessun gate (demo locale / smoke).
 * Header `X-Robots-Tag` se l’indicizzazione è spenta (`NEXT_PUBLIC_SITE_INDEX=0`).
 */
export async function middleware(request: NextRequest) {
  const { response, user, supabaseConfigured } = await updateSupabaseSession(request);
  let out = response;

  const pathname = request.nextUrl.pathname;
  const mobileAppRedirect = redirectForMobileAppQuery(request, response, pathname);
  if (mobileAppRedirect) {
    out = mobileAppRedirect;
  } else {
  const needsAuth =
    supabaseConfigured &&
    !user &&
    isProtectedProductShellPath(pathname) &&
    !isAnonymousAllowedPath(pathname);

  if (needsAuth) {
    const dest = new URL("/access", request.url);
    const returnTo = `${pathname}${request.nextUrl.search}`;
    dest.searchParams.set("next", returnTo);
    out = NextResponse.redirect(dest);
    forwardMiddlewareCookies(response, out);
  } else if (pathname === "/m" || pathname === "/m/") {
    const dest = new URL("/m/dashboard", request.url);
    out = NextResponse.redirect(dest);
    forwardMiddlewareCookies(response, out);
  } else if (
    user &&
    isMobileClientRequest(request) &&
    !isMobileAppPath(pathname) &&
    isMobileRedirectSourcePath(pathname)
  ) {
    const mobile = toMobilePath(pathname);
    if (mobile) {
      const dest = new URL(mobile, request.url);
      dest.search = request.nextUrl.search;
      out = NextResponse.redirect(dest);
      forwardMiddlewareCookies(response, out);
    }
  }
  }

  if (isSiteIndexingDisabled()) {
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return out;
}

export const config = {
  matcher: [
    /** Garmin Push/Ping POST può superare i limiti Edge middleware / ridurre superficie su webhook partner (Partner Verification). */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api\\/integrations\\/garmin\\/push(?:\\/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
