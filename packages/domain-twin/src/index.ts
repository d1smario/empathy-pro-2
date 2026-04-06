/** Unified athlete state projection — single source across modules. */
import type { IsoDateTime, TwinState } from "@empathy/contracts";

export const DOMAIN = "@empathy/domain-twin" as const;
export const DOMAIN_TITLE = "Digital twin";
export const DOMAIN_SUMMARY =
  "Stato unificato atleta (fitness, fatigue, readiness, adattamento) — allineato a TwinState in @empathy/contracts.";

export type { TwinState };

/** Scheletro minimo per wiring futuro; tutti i campi opzionali restano undefined. */
export function createTwinSkeleton(athleteId: string, asOf: IsoDateTime): TwinState {
  return { athleteId, asOf };
}
