/**
 * Re-export canonico: simulatore diurno e tile lab da `@empathy/domain-bioenergetics` (banca coefficienti v1).
 * Non duplicare logica qui.
 */
export {
  SIM_BANK_VERSION,
  buildNominalCortisolActhHourly24,
  buildSimulatedGluLacDiurnal,
  buildSimulatedGluLacDiurnalSubHourly,
  simulatedLabNumeric,
} from "@empathy/domain-bioenergetics";
