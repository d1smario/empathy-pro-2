/**
 * Daily subjective check-in — reality ingest for the Longevity & Fitness module.
 * One row per (athlete_id, checkin_date). Subjective scales + illness/symptom flags.
 * Canonical key: `athlete_id` (see empathy_athlete_memory.mdc).
 */

import type { IsoDate, IsoDateTime } from "./common";

/** Symptom / malaise flags the athlete can annotate for a day. */
export type DailyCheckinSymptom =
  | "fever"
  | "headache"
  | "sore_throat"
  | "gi_upset"
  | "cold_flu"
  | "injury"
  | "other";

export const DAILY_CHECKIN_SYMPTOMS: readonly DailyCheckinSymptom[] = [
  "fever",
  "headache",
  "sore_throat",
  "gi_upset",
  "cold_flu",
  "injury",
  "other",
] as const;

export function isDailyCheckinSymptom(value: string): value is DailyCheckinSymptom {
  return (DAILY_CHECKIN_SYMPTOMS as readonly string[]).includes(value);
}

/** Subjective 1–5 scales (1 = worst/none depending on field; see field docs). */
export type DailyCheckinScale = 1 | 2 | 3 | 4 | 5;

export type DailyCheckin = {
  athleteId: string;
  /** Logical calendar day (ISO yyyy-mm-dd). */
  checkinDate: IsoDate;
  /** 1 (drained) … 5 (peak). */
  energy?: DailyCheckinScale | null;
  /** 1 (low) … 5 (great). */
  mood?: DailyCheckinScale | null;
  /** 1 (poor) … 5 (excellent). */
  sleepQuality?: DailyCheckinScale | null;
  /** 1 (none) … 5 (severe). */
  soreness?: DailyCheckinScale | null;
  /** 1 (none) … 5 (severe). */
  stress?: DailyCheckinScale | null;
  /** 1 (none) … 5 (high). */
  motivation?: DailyCheckinScale | null;
  /** Illness / symptom annotations for the day. */
  illnessFlags: DailyCheckinSymptom[];
  /** Short free note. */
  note?: string | null;
  /** Ingest source, default self_report. */
  source?: string;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
};
