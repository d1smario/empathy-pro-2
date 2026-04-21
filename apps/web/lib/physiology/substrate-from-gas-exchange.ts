/**
 * Whole-body CHO / fat oxidation rates from VO₂ and VCO₂ (L/min) — Frayn-type stoichiometry.
 * Valid when RER is in a plausible band (~0.70–1.00); negative rates clamped to 0.
 *
 * Ref: Frayn KN (1983) Calculation of substrate oxidation rates in vivo from gaseous exchange.
 * Use with lab or high-quality metabolic cart data; optional future tie-in to continuous RER.
 */

export type SubstrateOxidationRates = {
  choGPerMin: number;
  fatGPerMin: number;
  rer: number;
  /** True if RER in [0.69, 1.02] and VO₂ > 0 */
  plausible: boolean;
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function substrateOxidationRatesFromGasExchange(vo2LMin: number, vco2LMin: number): SubstrateOxidationRates {
  const vo2 = Math.max(0, vo2LMin);
  const vco2 = Math.max(0, vco2LMin);
  const rer = vo2 > 1e-6 ? vco2 / vo2 : 0;
  const plausible = vo2 >= 0.15 && rer >= 0.69 && rer <= 1.02;

  const choRaw = 4.585 * vco2 - 3.225 * vo2;
  const fatRaw = 1.695 * vo2 - 1.701 * vco2;
  const choGPerMin = plausible ? clamp(choRaw, 0, 12) : clamp(choRaw, 0, 20);
  const fatGPerMin = plausible ? clamp(fatRaw, 0, 2.5) : clamp(fatRaw, 0, 4);

  return {
    choGPerMin: Math.round(choGPerMin * 1000) / 1000,
    fatGPerMin: Math.round(fatGPerMin * 1000) / 1000,
    rer: Math.round(rer * 1000) / 1000,
    plausible,
  };
}
