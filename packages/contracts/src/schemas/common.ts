/**
 * Common types: IDs, timestamps, enums, units.
 */

export type IsoDate = string; // YYYY-MM-DD
export type IsoDateTime = string; // ISO 8601

export type LoadSeriesPoint = {
  date: IsoDate;
  atl: number;
  ctl: number;
  tsb: number;
  /** Optional: standard deviation for internal load personal baseline */
  std?: number;
  /** Optional: z-score vs baseline */
  zScore?: number;
};

export type ConstraintLevel = "hard" | "soft" | "adaptive";
