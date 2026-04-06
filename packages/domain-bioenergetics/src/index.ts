/** Bioenergetics as dominant modulating layer (see CONSTITUTION.md). */
import type { BioenergeticProfile, InternalLoadState } from "@empathy/contracts";

export const DOMAIN = "@empathy/domain-bioenergetics" as const;
export const DOMAIN_TITLE = "Bioenergetics";
export const DOMAIN_SUMMARY =
  "Profilo bioenergetico e stato di carico interno (canali, divergenza attesa/osservata) — tipi da @empathy/contracts.";

export type { BioenergeticProfile, InternalLoadState };

const BIO_KEYS: (keyof BioenergeticProfile)[] = [
  "phaseAngleScore",
  "cellIntegrity",
  "mitochondrialEfficiency",
  "hydrationStatus",
  "inflammationProxy",
];

/** Chiavi numeriche valorizzate nel profilo (ispezione pura, niente scoring clinico). */
export function listDefinedBioenergeticNumericKeys(profile: BioenergeticProfile): string[] {
  return BIO_KEYS.filter((k) => typeof profile[k] === "number").map(String);
}
