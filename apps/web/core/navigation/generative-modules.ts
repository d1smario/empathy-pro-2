import { isProductModuleId, type ProductModuleId } from "@empathy/contracts";
import { stripMobileAppPrefix } from "@/core/navigation/mobile-module-registry";

/** Moduli dove la UI deve essere esposizione minimal (generazione / interpretazione), non dashboard-dense. */
const GENERATIVE: ReadonlySet<ProductModuleId> = new Set([
  "profile",
  "training",
  "nutrition",
  "bioenergetics",
  "physiology",
  "health",
  "biomechanics",
  "aerodynamics",
]);

export function isGenerativeProductModule(module: ProductModuleId): boolean {
  return GENERATIVE.has(module);
}

export function isGenerativePath(pathname: string): boolean {
  const normalized = stripMobileAppPrefix(
    pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname,
  );
  /** Builder denso (import graduale da V1): stesso shell ma backdrop / layout “prodotto”, non superficie generativa minimal. */
  if (
    normalized === "/training/builder" ||
    normalized.startsWith("/training/builder/") ||
    normalized === "/training/vyria" ||
    normalized.startsWith("/training/vyria/") ||
    normalized === "/training/virya" ||
    normalized.startsWith("/training/virya/") ||
    normalized === "/training/calendar" ||
    normalized.startsWith("/training/calendar/") ||
    normalized === "/training/analytics" ||
    normalized.startsWith("/training/analytics/") ||
    normalized === "/training/analyzer" ||
    normalized.startsWith("/training/analyzer/") ||
    normalized === "/training/session" ||
    normalized.startsWith("/training/session/")
  ) {
    return false;
  }
  const seg = normalized.split("/").filter(Boolean)[0];
  if (!seg || !isProductModuleId(seg)) return false;
  return GENERATIVE.has(seg);
}
