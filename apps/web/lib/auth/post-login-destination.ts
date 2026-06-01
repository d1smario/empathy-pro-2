import type { PendingAppRole } from "@/lib/auth/pending-role-cookie";
import { safeAppInternalPath } from "@/core/routing/guards";
import { preferMobileAppPath } from "@/core/navigation/mobile-module-registry";
import { ACCESS_PLAN_PATH } from "@/lib/billing/paywall-config";

/**
 * Destinazioni sicure subito dopo login: hub operativi che non montano viste pesanti
 * (calendario, physiology lab, builder con query) prima che contesto atleta e cookie siano stabili.
 */
const POST_LOGIN_SAFE_PATHS = new Set([
  "/dashboard",
  "/m/dashboard",
  "/profile",
  "/m/profile",
  "/settings",
  "/m/settings",
  "/athletes",
  ACCESS_PLAN_PATH,
]);

export type PostLoginDestinationInput = {
  /** `next` già validato con `safeAppInternalPath` lato caller se serve. */
  next: string;
  appRole: PendingAppRole;
  hasAthleteAccess: boolean;
  hasOperatorAccess: boolean;
  /** Su telefono/tablet: hub sicuri → equivalente `/m/*`. */
  preferMobile?: boolean;
};

/**
 * Dove mandare l'utente dopo auth riuscita (password, magic link callback, sessione già attiva su `/access`).
 * Coach / operator → hub Atleti. Atleta senza entitlement → gate piano. Atleta con accesso → dashboard
 * (salvo `next` esplicitamente sicuro), non la route protetta che aveva tentato prima del login.
 */
export function resolvePostLoginDestination(input: PostLoginDestinationInput): string {
  const next = safeAppInternalPath(input.next, "/dashboard");
  const preferMobile = input.preferMobile === true;

  if (input.appRole === "coach" || input.hasOperatorAccess) {
    return "/athletes";
  }

  if (!input.hasAthleteAccess) {
    return ACCESS_PLAN_PATH;
  }

  const base = (next.split("?")[0] ?? "/").replace(/\/$/, "") || "/";
  if (base === ACCESS_PLAN_PATH) {
    return preferMobileAppPath("/dashboard", preferMobile);
  }
  if (POST_LOGIN_SAFE_PATHS.has(base)) {
    return preferMobileAppPath(next, preferMobile);
  }

  return preferMobileAppPath("/dashboard", preferMobile);
}
