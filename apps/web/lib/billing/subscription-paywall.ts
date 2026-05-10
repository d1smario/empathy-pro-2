import "server-only";

import { redirect } from "next/navigation";
import { loadUserAccessEntitlement, type UserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

/**
 * Feature flag: `EMPATHY_PAYWALL_ENFORCED=true` attiva il blocco redirect.
 * Quando false (default), il guard è no-op: la console admin grants resta
 * comunque utilizzabile, ma nessun utente viene rediretto.
 */
function paywallEnforced(): boolean {
  return (process.env.EMPATHY_PAYWALL_ENFORCED ?? "").toLowerCase() === "true";
}

/**
 * Server-side gate per il layout (shell)/. Comportamento:
 *   - Anonimo (no session) → no-op (il login resta gestito dalle pagine, redirect a /access).
 *   - Loggato + (paid OR grant attivo OR admin OR coach approved) → passa.
 *   - Loggato senza nessun entitlement E flag attiva → redirect a /pricing?required=athlete_access.
 *   - Flag spenta → no-op anche per loggati senza entitlement (modalità transizione).
 *
 * NON tocca le API: ognuna ha già `requireAthleteRead/WriteContext` con
 * `canAccessAthleteData` per autorizzazione granulare. Il paywall qui blocca
 * solo l'ingresso UI; per limitare anche le API serve patch separata.
 */
export async function gateAuthenticatedShellAccessOrRedirect(): Promise<UserAccessEntitlement | null> {
  const cookieClient = createSupabaseCookieClient();
  if (!cookieClient) return null;

  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  if (!user) return null;

  const adminClient = createSupabaseAdminClient();
  const db = adminClient ?? cookieClient;

  const entitlement = await loadUserAccessEntitlement(db, user.id);

  if (!paywallEnforced()) {
    return entitlement;
  }

  // Ammettiamo anche `coach_operator`: un coach approved (gratis) può accedere
  // alla shell per gestire roster, anche senza grant atleta proprio.
  if (entitlement.hasAthleteAccess || entitlement.hasOperatorAccess) {
    return entitlement;
  }

  redirect("/pricing?required=athlete_access");
}
