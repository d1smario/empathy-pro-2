import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAnonymousAllowedPath, isProtectedProductShellPath } from "@/core/routing/guards";
import { isSiteIndexingDisabled } from "@/lib/site-url";
import { forwardMiddlewareCookies, updateSupabaseSession } from "@/lib/supabase/update-session";

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
  }

  if (isSiteIndexingDisabled()) {
    out.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return out;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
