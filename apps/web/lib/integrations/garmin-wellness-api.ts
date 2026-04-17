import "server-only";

/**
 * Garmin Wellness API — **Prod** (`Servers` in apiDocs).
 * Base: documentazione autenticata [Garmin API Docs / Wellness](https://apis.garmin.com/tools/apiDocs)
 * (login Client Id + Secret); endpoint summary: `https://apis.garmin.com/wellness-api`.
 *
 * I path qui sotto sono i **GET** summary + **User API** / **User Controller** come da OpenAPI incollata.
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
