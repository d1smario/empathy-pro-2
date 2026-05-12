import "server-only";

/**
 * Garmin Wellness API — **Prod** (`Servers` in apiDocs).
 * Base: documentazione autenticata [Garmin API Docs / Wellness](https://apis.garmin.com/tools/apiDocs)
 * (login Client Id + Secret); endpoint summary: `https://apis.garmin.com/wellness-api`.
 *
 * I path qui sotto sono i **GET** summary + **User API** come da OpenAPI / apiDocs. Lessico utile:
 * - **GET `/rest/user/id`** → JSON `{ "userId": "<hex>" }` (ID Health API stabile sullo stesso utente tra token).
 * - **GET `/rest/activityDetails`** → query `token` (pull token OAuth2 / notifica), opzionale finestra
 *   `uploadStartTimeInSeconds` + `uploadEndTimeInSeconds` (se usati, **sempre in coppia**). Risposta **JSON**
 *   (serie/campioni), **non** il file FIT nativo.
 * - **GET `/rest/activityFile`** → query `id`, `token`; **200** spesso `application/octet-stream` (FIT/TCX/GPX).
 *   Garmin: i file **non** arrivano via Push; solo in risposta a **Ping** chiamando il `callbackURL` indicato.
 *   Push **`activityDetails`** su ingest Fly (es. `https://empathy-garmin-ingest.fly.dev/api/integrations/garmin/push/activityDetails`):
 *   body grande = **solo JSON**; il FIT passa da **questo GET** (job in `garmin_pull_jobs`).
 *   Partner Garmin: **Activity Details** = PUSH *oppure* PING/PULL (`GET /rest/activityDetails`), non entrambi.
 *   Se usi Push per i Details, imposta `GARMIN_ACTIVITY_DETAILS_VIA_PUSH=true` sul runner così non si accoda anche il GET.
 *   Dopo un pull `activities`, Empathy accoda GET `activityFile` e, salvo flag sopra, GET `activityDetails`
 *   (`garmin-activity-follow-up-pull-queue` + `garmin-pull-runner`).
 * - **GET `/rest/dailies` (e molti altri summary)** → la URL operativa arriva dalla **Ping/Push** con **`token=`** (pull token)
 *   nell’query string; il solo `Authorization: Bearer` dell’OAuth2 utente **non** sostituisce quel token →
 *   errore tipico `InvalidPullTokenException`. OAuth2 serve a collegare l’utente e a `user/id`, `user/permissions`; il pull verso
 *   `callbackURL` usa consumer key/secret partner + `token` (e spesso OAuth1), vedi `garmin-pull-runner.ts`.
 * - Errori HTTP: corpo JSON tipico `{ "errorMessage": "..." }` (vedi `tryParseGarminApiErrorMessage`).
 * - **Summary Backfill**: `GET /rest/backfill/<stream>` con query `summaryStartTimeInSeconds` +
 *   `summaryEndTimeInSeconds` (obbligatorie); successo spesso **202**. Una singola richiesta non deve eccedere circa **90 giorni**
 *   di intervallo (spec Health API); Empathy taglia l’arco alle ultime ~90 giorni se necessario. Implementazione: `garmin-wellness-backfill.ts`.
 */
export const GARMIN_WELLNESS_API_PROD_BASE_URL = "https://apis.garmin.com/wellness-api" as const;

export const GARMIN_WELLNESS_USER_REST_PATHS = {
  /** GET — Health API ID stabile per l’utente (Bearer). */
  id: "/rest/user/id",
  /** GET — permessi consumer. */
  permissions: "/rest/user/permissions",
  /** DELETE — revoca token / associazione app–utente. */
  registration: "/rest/user/registration",
} as const;

/** GET summary endpoints (`/rest/...`) in ordine documentato portal. */
export const GARMIN_WELLNESS_SUMMARY_GET_REST_PATHS = [
  "/rest/userMetrics",
  "/rest/stressDetails",
  "/rest/solarIntensity",
  "/rest/sleeps",
  "/rest/skinTemp",
  "/rest/respiration",
  "/rest/pulseOx",
  "/rest/moveiq",
  "/rest/mct",
  "/rest/manuallyUpdatedActivities",
  "/rest/hrv",
  "/rest/healthSnapshot",
  "/rest/epochs",
  "/rest/dailies",
  "/rest/bodyComps",
  "/rest/bloodPressures",
  "/rest/activityFile",
  "/rest/activityDetails",
  "/rest/activities",
] as const;

export function garminWellnessAbsoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${GARMIN_WELLNESS_API_PROD_BASE_URL}${p}`;
}
