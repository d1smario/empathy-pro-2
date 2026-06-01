import type { ProductModuleId } from "@empathy/contracts";
import type { ProductNavIconKey } from "@/core/navigation/module-registry";

/** Prefisso route app mobile — parallelo a `(shell)` desktop, stesso deploy. */
export const MOBILE_APP_PREFIX = "/m";

/** Cookie opt-out: utente preferisce shell desktop su telefono. */
export const EMPATHY_DESKTOP_COOKIE = "empathy_desktop";

/** Cookie opt-in: forza shell mobile (es. recupero da opt-out o link `?app=1`). */
export const EMPATHY_MOBILE_COOKIE = "empathy_mobile";

export type MobileBottomNavItem = {
  key: string;
  module: ProductModuleId;
  href: `${typeof MOBILE_APP_PREFIX}/${string}`;
  label: string;
  icon: ProductNavIconKey;
  /** Tab che apre il drawer moduli invece di navigare. */
  action?: "open-menu";
};

/** Tab bar principale atleta. */
export const MOBILE_BOTTOM_NAV: MobileBottomNavItem[] = [
  { key: "today", module: "dashboard", href: "/m/dashboard", label: "Oggi", icon: "chart" },
  { key: "training", module: "training", href: "/m/training/calendar", label: "Training", icon: "calendar" },
  { key: "nutrition", module: "nutrition", href: "/m/nutrition", label: "Nutrition", icon: "utensils" },
  { key: "profile", module: "profile", href: "/m/profile", label: "Profile", icon: "user" },
  { key: "modules", module: "settings", href: "/m/settings", label: "Moduli", icon: "settings", action: "open-menu" },
];

export type MobileMenuItem = {
  key: string;
  module?: ProductModuleId;
  href: `${typeof MOBILE_APP_PREFIX}/${string}` | `/${string}`;
  label: string;
  icon: ProductNavIconKey;
  /** Route desktop: apre fuori shell mobile (builder, coach, ecc.). */
  desktopOnly?: boolean;
};

export type MobileMenuSection = {
  key: string;
  title: string;
  items: MobileMenuItem[];
};

/** Menu moduli completo (drawer) — griglia a sezioni. */
export const MOBILE_MODULE_MENU_SECTIONS: MobileMenuSection[] = [
  {
    key: "hub",
    title: "Operativo",
    items: [
      { key: "dashboard", module: "dashboard", href: "/m/dashboard", label: "Oggi", icon: "chart" },
      { key: "training", module: "training", href: "/m/training/calendar", label: "Training", icon: "calendar" },
      { key: "nutrition", module: "nutrition", href: "/m/nutrition", label: "Nutrition", icon: "utensils" },
      { key: "profile", module: "profile", href: "/m/profile", label: "Profile", icon: "user" },
    ],
  },
  {
    key: "health",
    title: "Salute & performance",
    items: [
      { key: "health", module: "health", href: "/m/health", label: "Health & Bio", icon: "heart" },
      { key: "physiology", module: "physiology", href: "/m/physiology", label: "Physiology", icon: "activity" },
      {
        key: "bioenergetics",
        module: "bioenergetics",
        href: "/m/bioenergetics",
        label: "BioEnergetics",
        icon: "pulse",
      },
      { key: "longevity", module: "longevity", href: "/m/longevity", label: "Longevity & Fitness", icon: "award" },
    ],
  },
  {
    key: "lab",
    title: "Lab & motion",
    items: [
      { key: "biomechanics", module: "biomechanics", href: "/m/biomechanics", label: "Biomechanics", icon: "motion" },
      { key: "aerodynamics", module: "aerodynamics", href: "/m/aerodynamics", label: "Aerodynamics", icon: "wind" },
    ],
  },
  {
    key: "system",
    title: "Sistema",
    items: [
      { key: "settings", module: "settings", href: "/m/settings", label: "Impostazioni", icon: "settings" },
      { key: "athletes", module: "athletes", href: "/athletes", label: "Coach · Atleti", icon: "users", desktopOnly: true },
      { key: "desktop", href: "/dashboard", label: "Versione desktop", icon: "chart", desktopOnly: true },
    ],
  },
];

/** @deprecated Usare MOBILE_MODULE_MENU_SECTIONS */
export const MOBILE_DRAWER_LINKS = MOBILE_MODULE_MENU_SECTIONS.flatMap((section) => section.items);

export function getMobileMenuItemForPath(pathname: string): MobileMenuItem | undefined {
  const n = normalizePathname(pathname);
  for (const section of MOBILE_MODULE_MENU_SECTIONS) {
    for (const item of section.items) {
      if (n === item.href || n.startsWith(`${item.href}/`)) return item;
      if (item.module === "training" && n.startsWith("/m/training")) return item;
      if (item.module === "nutrition" && n.startsWith("/m/nutrition")) return item;
    }
  }
  return undefined;
}

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
 * Path desktop → mobile se esiste equivalente.
 * `null` = restare su desktop (builder, coach, moduli non coperti).
 */
export function toMobilePath(pathname: string): string | null {
  const n = normalizePathname(pathname);
  if (isMobileAppPath(n)) return n;

  const directMap: Array<[string, string]> = [
    ["/dashboard", `${MOBILE_APP_PREFIX}/dashboard`],
    ["/profile", `${MOBILE_APP_PREFIX}/profile`],
    ["/settings", `${MOBILE_APP_PREFIX}/settings`],
    ["/health", `${MOBILE_APP_PREFIX}/health`],
    ["/physiology", `${MOBILE_APP_PREFIX}/physiology`],
    ["/bioenergetics", `${MOBILE_APP_PREFIX}/bioenergetics`],
    ["/biomechanics", `${MOBILE_APP_PREFIX}/biomechanics`],
    ["/aerodynamics", `${MOBILE_APP_PREFIX}/aerodynamics`],
    ["/longevity", `${MOBILE_APP_PREFIX}/longevity`],
  ];

  for (const [desktop, mobile] of directMap) {
    if (n === desktop || n.startsWith(`${desktop}/`)) return mobile;
  }

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

  const moduleMap: Record<string, string> = {
    [`${MOBILE_APP_PREFIX}/dashboard`]: "/dashboard",
    [`${MOBILE_APP_PREFIX}/profile`]: "/profile",
    [`${MOBILE_APP_PREFIX}/settings`]: "/settings",
    [`${MOBILE_APP_PREFIX}/health`]: "/health",
    [`${MOBILE_APP_PREFIX}/physiology`]: "/physiology",
    [`${MOBILE_APP_PREFIX}/bioenergetics`]: "/bioenergetics",
    [`${MOBILE_APP_PREFIX}/biomechanics`]: "/biomechanics",
    [`${MOBILE_APP_PREFIX}/aerodynamics`]: "/aerodynamics",
    [`${MOBILE_APP_PREFIX}/longevity`]: "/longevity",
    [`${MOBILE_APP_PREFIX}/training/calendar`]: "/training/calendar",
    [`${MOBILE_APP_PREFIX}/training/session`]: "/training/session",
    [`${MOBILE_APP_PREFIX}/nutrition`]: "/nutrition/meal-plan",
    [`${MOBILE_APP_PREFIX}/nutrition/diary`]: "/nutrition/diary",
  };

  if (moduleMap[n]) return moduleMap[n];
  if (n.startsWith(`${MOBILE_APP_PREFIX}/training/session/`)) {
    return n.slice(MOBILE_APP_PREFIX.length);
  }
  if (n === `${MOBILE_APP_PREFIX}/nutrition/meal-plan` || n.startsWith(`${MOBILE_APP_PREFIX}/nutrition/meal-plan/`)) {
    return "/nutrition/meal-plan";
  }

  return "/dashboard";
}

export function isMobileRedirectSourcePath(pathname: string): boolean {
  return toMobilePath(pathname) != null;
}

/** Applica equivalente mobile se esiste (post-login, link interni). */
export function preferMobileAppPath(pathname: string, preferMobile: boolean): string {
  if (!preferMobile) return pathname;

  const [baseRaw, ...queryParts] = pathname.split("?");
  const base = normalizePathname(baseRaw ?? "/");
  const query = queryParts.length ? `?${queryParts.join("?")}` : "";
  const mobile = toMobilePath(base);
  return mobile ? `${mobile}${query}` : pathname;
}
