/**
 * VO₂ mono-exponential onset toward maximum (exercise VO₂ kinetics, schematic).
 * VO₂(t) ≈ VO₂max·(1 − e^(−t/τ)); useful when VO₂max (L/min) is known from lab or field estimate.
 *
 * τ (s): time constant — literature ~20–45 s for moderate domain, longer when deconditioned.
 * Not a replacement for cardiopulmonary measurement; pairs with future continuous VO₂ streams.
 */

export type Vo2KineticsPhenotype = "oxidative" | "balanced" | "glycolytic";

export function defaultVo2OnsetTauSec(phenotype: Vo2KineticsPhenotype): number {
  if (phenotype === "oxidative") return 28;
  if (phenotype === "glycolytic") return 38;
  return 32;
}

/**
 * Predicted VO₂ at time t (same units as vo2maxLMin), approaching vo2maxLMin.
 */
export function vo2LMinAtTimeOnset(vo2maxLMin: number, timeSec: number, tauSec: number): number {
  const vmax = Math.max(0, vo2maxLMin);
  const tau = Math.max(4, tauSec);
  const t = Math.max(0, timeSec);
  return vmax * (1 - Math.exp(-t / tau));
}

/** Fraction of VO₂max reached at t (0–1). */
export function vo2OnsetFractionAtTime(timeSec: number, tauSec: number): number {
  const tau = Math.max(4, tauSec);
  const t = Math.max(0, timeSec);
  return 1 - Math.exp(-t / tau);
}
