/**
 * Contract-first types shared by apps, domain packages, and (later) API handlers.
 * Port shapes from V1 api module contracts (e.g. api/training/contracts.ts) incrementally; avoid importing V1 at runtime.
 */

export const EMPATHY_PLATFORM_VERSION = "2.0.0-scaffold" as const;

/** Branded IDs - replace with UUID validation / zod at boundary. */
export type AthleteId = string & { readonly __brand: "AthleteId" };
export type CoachId = string & { readonly __brand: "CoachId" };
export type AccountId = string & { readonly __brand: "AccountId" };

export type ProductModuleId =
  | "dashboard"
  | "profile"
  | "physiology"
  | "training"
  | "nutrition"
  | "health"
  | "biomechanics"
  | "aerodynamics"
  | "athletes"
  | "settings";

/** Primary stimulus for internal-load modeling when power is not canonical. */
export type DisciplineKind =
  | "cycling"
  | "running"
  | "swimming"
  | "nordic_ski"
  | "other";

/** Discipline context for internal-load hints (see domain-training). */
export type DisciplineContext = {
  kind: DisciplineKind;
  primaryMetricHint?: string;
};
