/**
 * Nomi stream **GET …/rest/backfill/&lt;stream&gt;** (Wellness API / apiDocs).
 * Condiviso tra server route e UI profilo (nessun `server-only`).
 */
export const GARMIN_SUMMARY_BACKFILL_STREAMS = [
  "userMetrics",
  "stressDetails",
  "sleeps",
  "skinTemp",
  "respiration",
  "pulseOx",
  "moveiq",
  "mct",
  "hrv",
  "healthSnapshot",
  "epochs",
  "dailies",
  "bodyComps",
  "bloodPressures",
  "activityDetails",
] as const;

export type GarminSummaryBackfillStream = (typeof GARMIN_SUMMARY_BACKFILL_STREAMS)[number];
