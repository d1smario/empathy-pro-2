import "server-only";

/**
 * PRO2 — **Contesto lettura atleta unico** per le API modulo (linguaggio condiviso tra Training, Nutrition,
 * Health, Dashboard, Profile, …).
 *
 * **Stack (sempre nello stesso ordine):**
 * 1. Identità: `Authorization: Bearer` **oppure** cookie session Supabase.
 * 2. Autorizzazione atleta: `canAccessAthleteData` (profilo collegato o coach in `coach_athletes`).
 * 3. Client DB: `supabaseForTrainingReadAfterAuth` — preferisce **service role** se configurato (parity letture training).
 *
 * **Dati dominio** (memory, planned/executed window, bundle operativi): sempre **dopo** `requireAthleteReadContext`.
 * Non duplicare gate alternativi (`createServerSupabaseClient` + Bearer-only) per lo stesso `athleteId`.
 *
 * @see {@link queryPlannedExecutedWindow} finestra calendario operativa
 * @see {@link resolveAthleteMemory} spina `AthleteMemory`
 * @see {@link summarizeReadSpineCoverage} copertura read-spine lato UI
 * @see `docs/PRO2_APPLICATION_READ_SPINE_AND_INTERPRETATION_STAGING.md` — collocazione nel modello generativo a 4 piani + staging L2
 */
export {
  TrainingRouteAuthError as AthleteReadContextError,
  requireAuthenticatedTrainingUser,
  requireTrainingAthleteReadContext as requireAthleteReadContext,
  requireTrainingAthleteWriteContext as requireAthleteWriteContext,
  supabaseForTrainingReadAfterAuth as supabaseForAthleteTableRead,
} from "./training-route-auth";
