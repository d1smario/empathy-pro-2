/**
 * Org multitenant coach↔atleta. Deve coincidere con il seed in `supabase/migrations/000_pro2_orgs.sql`.
 */
export const EMPATHY_DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001";

/** Server / route handlers: `EMPATHY_COACH_ATHLETES_ORG_ID` opzionale; default = seed migration. */
export function coachOrgIdForDb(): string {
  const fromEnv = process.env.EMPATHY_COACH_ATHLETES_ORG_ID?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : EMPATHY_DEFAULT_ORG_ID;
}

/** Client: nel bundle è disponibile solo `NEXT_PUBLIC_*`. Allinealo al valore server in deploy. */
export function coachOrgIdForClient(): string {
  const pub =
    typeof process.env.NEXT_PUBLIC_EMPATHY_COACH_ATHLETES_ORG_ID === "string"
      ? process.env.NEXT_PUBLIC_EMPATHY_COACH_ATHLETES_ORG_ID.trim()
      : "";
  return pub || EMPATHY_DEFAULT_ORG_ID;
}
