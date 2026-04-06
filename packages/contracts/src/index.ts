/**
 * Contract-first types shared by apps, domain packages, and API handlers.
 *
 * Punto 1 piano Pro 2: modello canonico `./schemas` (no import `@/`), view-model `./api/*`.
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

/** Chiavi esaustive: se manca un id del union, TypeScript segnala errore. */
export const PRODUCT_MODULE_ROUTE_MAP = {
  dashboard: true,
  profile: true,
  physiology: true,
  training: true,
  nutrition: true,
  health: true,
  biomechanics: true,
  aerodynamics: true,
  athletes: true,
  settings: true,
} as const satisfies Record<ProductModuleId, unknown>;

export function isProductModuleId(value: string): value is ProductModuleId {
  return value in PRODUCT_MODULE_ROUTE_MAP;
}

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

export * from "./schemas";
export * from "./api/access";
export * from "./api/knowledge";
export * from "./api/profile";
