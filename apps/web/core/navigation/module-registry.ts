import type { ProductModuleId } from "@empathy/contracts";

/** Lucide icon names used by the product shell (see ProductSidebar). */
export type ProductNavIconKey =
  | "chart"
  | "users"
  | "user"
  | "heart"
  | "activity"
  | "calendar"
  | "utensils"
  | "motion"
  | "wind"
  | "settings";

export type ProductModuleNavArea = "main" | "footer";

export type ProductModuleNavItem = {
  module: ProductModuleId;
  href: `/${string}`;
  label: string;
  icon: ProductNavIconKey;
  /** Main rail vs footer (settings). Coach-facing modules stay in `main`. */
  area: ProductModuleNavArea;
};

/**
 * Single source of truth for product URLs + labels.
 * Order: operational hub first, coach area early, then depth modules.
 */
export const PRODUCT_MODULE_NAV: ProductModuleNavItem[] = [
  { module: "dashboard", href: "/dashboard", label: "Dashboard", icon: "chart", area: "main" },
  { module: "athletes", href: "/athletes", label: "Coach · Atleti", icon: "users", area: "main" },
  { module: "profile", href: "/profile", label: "Profile", icon: "user", area: "main" },
  { module: "health", href: "/health", label: "Health & Bio", icon: "heart", area: "main" },
  { module: "physiology", href: "/physiology", label: "Physiology", icon: "activity", area: "main" },
  { module: "training", href: "/training", label: "Training", icon: "calendar", area: "main" },
  { module: "nutrition", href: "/nutrition", label: "Nutrition", icon: "utensils", area: "main" },
  { module: "biomechanics", href: "/biomechanics", label: "Biomechanics", icon: "motion", area: "main" },
  { module: "aerodynamics", href: "/aerodynamics", label: "Aerodynamics", icon: "wind", area: "main" },
  { module: "settings", href: "/settings", label: "Impostazioni", icon: "settings", area: "footer" },
];

const byHref = new Map<string, ProductModuleNavItem>(
  PRODUCT_MODULE_NAV.map((item) => [item.href, item]),
);

const byModule = new Map<ProductModuleId, ProductModuleNavItem>(
  PRODUCT_MODULE_NAV.map((item) => [item.module, item]),
);

export function getProductNavItemByHref(pathname: string): ProductModuleNavItem | undefined {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return byHref.get(normalized);
}

export function getProductNavItemByModule(module: ProductModuleId): ProductModuleNavItem | undefined {
  return byModule.get(module);
}

export function pathSegmentFromHref(href: string): string {
  return href.replace(/^\//, "");
}
