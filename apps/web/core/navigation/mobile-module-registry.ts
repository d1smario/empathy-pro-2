import type { ProductModuleId } from "@empathy/contracts";
import type { ProductNavIconKey } from "@/core/navigation/module-registry";

/** Prefisso route app mobile — parallelo a `(shell)` desktop, stesso deploy. */
export const MOBILE_APP_PREFIX = "/m";

/** Cookie opt-out: utente preferisce shell desktop su telefono. */
export const EMPATHY_DESKTOP_COOKIE = "empathy_desktop";

export type MobileBottomNavItem = {
  key: string;
  module: ProductModuleId;
  href: `${typeof MOBILE_APP_PREFIX}/${string}`;
  label: string;
  icon: ProductNavIconKey;
};

/** Tab bar MVP atleta (coach in fase 2). */
export const MOBILE_BOTTOM_NAV: MobileBottomNavItem[] = [
  { key: "today", module: "dashboard", href: "/m/dashboard", label: "Oggi", icon: "chart" },
  { key: "training", module: "training", href: "/m/training/calendar", label: "Training", icon: "calendar" },
  { key: "nutrition", module: "nutrition", href: "/m/nutrition", label: "Nutrition", icon: "utensils" },
  { key: "profile", module: "profile", href: "/m/profile", label: "Profile", icon: "user" },
];

/** Moduli secondari nel drawer mobile. */
export const MOBILE_DRAWER_LINKS: Array<{
  href: `${typeof MOBILE_APP_PREFIX}/${string}` | `/${string}`;
  label: string;
  desktopOnly?: boolean;
}> = [
  { href: "/m/settings", label: "Impostazioni" },
  { href: "/health", label: "Health & Bio", desktopOnly: true },
  { href: "/physiology", label: "Physiology", desktopOnly: true },
  { href: "/dashboard", label: "Versione desktop", desktopOnly: true },
];

function normalizePathname(pathname: string): string {
  const n = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return n || "/";
}

export function isMobileAppPath(pathname: string): boolean {
  const n = normalizePathname(pathname);
  return n === MOBILE_APP_PREFIX || n.startsWith(`${MOBILE_APP_PREFIX}/`);
}

/** Rimuove `/m` per riusare policy path desktop (athlete gate, generative, ecc.). */
export function stripMobileAppPrefix(pathname: string): string {
  const n = normalizePathname(pathname);
  if (n === MOBILE_APP_PREFIX) return "/dashboard";
  if (n.startsWith(`${MOBILE_APP_PREFIX}/`)) {
    const rest = n.slice(MOBILE_APP_PREFIX.length);
    return rest.length ? rest : "/dashboard";
  }
  return n;
}

/**
 * Path desktop → mobile se esiste equivalente MVP.
 * `null` = restare su desktop (builder, coach, moduli non coperti).
 */
export function toMobilePath(pathname: string): string | null {
  const n = normalizePathname(pathname);
  if (isMobileAppPath(n)) return n;

  if (n === "/dashboard" || n.startsWith("/dashboard/")) return `${MOBILE_APP_PREFIX}/dashboard`;
  if (n === "/profile" || n.startsWith("/profile/")) return `${MOBILE_APP_PREFIX}/profile`;
  if (n === "/settings" || n.startsWith("/settings/")) return `${MOBILE_APP_PREFIX}/settings`;

  if (n === "/training/calendar" || n.startsWith("/training/calendar/")) {
    return `${MOBILE_APP_PREFIX}/training/calendar`;
  }
  if (n === "/training/session") return `${MOBILE_APP_PREFIX}/training/session`;
  if (n.startsWith("/training/session/")) {
    return `${MOBILE_APP_PREFIX}${n}`;
  }

  if (n === "/nutrition" || n === "/nutrition/meal-plan" || n.startsWith("/nutrition/meal-plan/")) {
    return `${MOBILE_APP_PREFIX}/nutrition/meal-plan`;
  }
  if (n === "/nutrition/diary" || n.startsWith("/nutrition/diary/")) {
    return `${MOBILE_APP_PREFIX}/nutrition/diary`;
  }

  return null;
}

export function toDesktopPath(mobilePathname: string): string {
  const n = normalizePathname(mobilePathname);
  if (!isMobileAppPath(n)) return n;
  if (n === `${MOBILE_APP_PREFIX}/dashboard`) return "/dashboard";
  if (n === `${MOBILE_APP_PREFIX}/profile`) return "/profile";
  if (n === `${MOBILE_APP_PREFIX}/settings`) return "/settings";
  if (n === `${MOBILE_APP_PREFIX}/training/calendar`) return "/training/calendar";
  if (n === `${MOBILE_APP_PREFIX}/training/session`) return "/training/session";
  if (n.startsWith(`${MOBILE_APP_PREFIX}/training/session/`)) {
    return n.slice(MOBILE_APP_PREFIX.length);
  }
  if (n === `${MOBILE_APP_PREFIX}/nutrition`) return "/nutrition/meal-plan";
  if (n === `${MOBILE_APP_PREFIX}/nutrition/diary`) return "/nutrition/diary";
  return "/dashboard";
}

export function isMobileRedirectSourcePath(pathname: string): boolean {
  return toMobilePath(pathname) != null;
}
