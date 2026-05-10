import { ATHLETE_TIME_SERIES_CHANNEL_V1 } from "@empathy/contracts";

/** Conteggi da `slice.timeSeriesSamplesRows` (migration 055), senza query aggiuntive. */
export function summarizeCanonicalTimeSeriesRows(
  rows: Array<Record<string, unknown>> | undefined,
): { glucoseSampleCount: number; lactateSampleCount: number } {
  let glucoseSampleCount = 0;
  let lactateSampleCount = 0;
  if (!rows?.length) return { glucoseSampleCount, lactateSampleCount };
  for (const row of rows) {
    const ch = typeof row.channel === "string" ? row.channel : "";
    if (ch === ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L) glucoseSampleCount += 1;
    else if (ch === ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L) lactateSampleCount += 1;
  }
  return { glucoseSampleCount, lactateSampleCount };
}
