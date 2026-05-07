import "server-only";

import type { GarminSummaryBackfillStream } from "@/lib/integrations/garmin-summary-backfill-streams";
import { isGarminSummaryBackfillStream } from "@/lib/integrations/garmin-wellness-backfill";

/** Default: attività + base wellness utile al panel giornaliero. */
const DEFAULT_POST_CONNECT: GarminSummaryBackfillStream[] = [
  "activityDetails",
  "dailies",
  "sleeps",
  "hrv",
];

/**
 * Stream Summary Backfill invocati dal callback OAuth (best-effort).
 * Override: `GARMIN_POST_CONNECT_BACKFILL_STREAMS=dailies,sleeps,hrv,stressDetails` (nomi apiDocs).
 */
export function readGarminPostConnectBackfillStreams(): GarminSummaryBackfillStream[] {
  const raw = process.env.GARMIN_POST_CONNECT_BACKFILL_STREAMS?.trim();
  if (!raw) return [...DEFAULT_POST_CONNECT];
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: GarminSummaryBackfillStream[] = [];
  for (const p of parts) {
    if (isGarminSummaryBackfillStream(p)) out.push(p);
  }
  return out.length > 0 ? out : [...DEFAULT_POST_CONNECT];
}

/** Override giorni indietro (UTC), clamp 1–365. Default 28. */
export function readGarminPostConnectBackfillDays(): number {
  const raw = process.env.GARMIN_POST_CONNECT_BACKFILL_DAYS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 1) return Math.min(365, Math.floor(n));
  return 28;
}
