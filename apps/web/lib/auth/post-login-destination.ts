import type { PendingAppRole } from "@/lib/auth/pending-role-cookie";
import { safeAppInternalPath } from "@/core/routing/guards";
import { ACCESS_PLAN_PATH } from "@/lib/billing/paywall-config";

/**
 * Destinazioni sicure subito dopo login: hub operativi che non montano viste pesanti
 * (calendario, physiology lab, builder con query) prima che contesto atleta e cookie siano stabili.
 */
const POST_LOGIN_SAFE_PATHS = new Set([
  "/dashboard",
  "/profile",
  "/settings",
  "/athletes",
  ACCESS_PLAN_PATH,
]);

export type PostLoginDestinationInput = {
  /** `next` già validato con `safeAppInternalPath` lato caller se serve. */
  next: string;
  appRole: PendingAppRole;
  hasAthleteAccess: boolean;
  hasOperatorAccess: boolean;
};

/**
 * Dove mandare l'utente dopo auth riuscita (password, magic link callback, sessione già attiva su `/access`).
 * Coach / operator → hub Atleti. Atleta senza entitlement → gate piano. Atleta con accesso → dashboard
 * (salvo `next` esplicitamente sicuro), non la route protetta che aveva tentato prima del login.
 */
export function resolvePostLoginDestination(input: PostLoginDestinationInput): string {
  const next = safeAppInternalPath(input.next, "/dashboard");

  if (input.appRole === "coach" || input.hasOperatorAccess) {
    return "/athletes";
  }

  if (!input.hasAthleteAccess) {
    return ACCESS_PLAN_PATH;
  }

  const base = (next.split("?")[0] ?? "/").replace(/\/$/, "") || "/";
  if (base === ACCESS_PLAN_PATH) {
    return "/dashboard";
  }
  if (POST_LOGIN_SAFE_PATHS.has(base)) {
    return next;
  }

  return "/dashboard";
}
