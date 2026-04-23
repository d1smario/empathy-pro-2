/**
 * Route policy for Pro 2 web. Anonymous allowlist + product shell protection helpers.
 * Redirect policy lives in middleware (session refresh + gate when Supabase è configurato).
 */

import { PRODUCT_MODULE_NAV } from "@/core/navigation/module-registry";

const ANONYMOUS_PREFIXES = ["/preview"] as const;

/** Paths that never require a session (marketing, static demo, access, auth callback). */
export function isAnonymousAllowedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/access" || pathname === "/pricing") return true;
  if (pathname === "/auth/callback" || pathname.startsWith("/auth/callback")) return true;
  if (pathname === "/auth/set-password" || pathname.startsWith("/auth/set-password/")) return true;
  if (pathname === "/invite" || pathname.startsWith("/invite/")) return true;
  return ANONYMOUS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Moduli registrati in shell: richiedono sessione se Supabase pubblico è configurato. */
export function isProtectedProductShellPath(pathname: string): boolean {
  const n = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (n === "/admin" || n.startsWith("/admin/")) return true;
  return PRODUCT_MODULE_NAV.some((item) => n === item.href || n.startsWith(`${item.href}/`));
}

/**
 * Solo path interni (anti open-redirect). Accetta path + query, es. `/training?tab=1`.
 */
export function safeAppInternalPath(raw: string | null, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

/** First URL segment for a product shell route, e.g. `/training/foo` → `training`. */
export function firstPathSegment(pathname: string): string | null {
  const trimmed = pathname.replace(/\/$/, "") || "/";
  if (!trimmed.startsWith("/")) return null;
  const parts = trimmed.split("/").filter(Boolean);
  return parts[0] ?? null;
}
