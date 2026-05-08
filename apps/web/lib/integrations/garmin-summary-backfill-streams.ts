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

/** Activity API: max ~30 giorni per singola richiesta Summary Backfill (activities, activityDetails, moveiq). */
const GARMIN_ACTIVITY_LIKE_BACKFILL_STREAMS = new Set<string>(["moveiq", "activityDetails", "activities"]);

const DAYS_ACTIVITY_BACKFILL = 30;
const DAYS_HEALTH_BACKFILL = 90;

/**
 * Secondi massimi coperti da **una** richiesta `GET …/rest/backfill/<stream>` (Health vs Activity API).
 */
export function maxRangeSecondsForGarminSummaryBackfillStream(stream: GarminSummaryBackfillStream): number {
  const days = GARMIN_ACTIVITY_LIKE_BACKFILL_STREAMS.has(stream) ? DAYS_ACTIVITY_BACKFILL : DAYS_HEALTH_BACKFILL;
  return days * 86_400;
}

/** Preset Profilo: un solo click richiede più stream wellness (stesso intervallo giorni). */
export const GARMIN_WELLNESS_BATCH_BACKFILL_STREAMS: GarminSummaryBackfillStream[] = [
  "dailies",
  "sleeps",
  "hrv",
  "stressDetails",
];
