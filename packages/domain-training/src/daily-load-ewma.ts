/**
 * Smoothing esponenziale giornaliero su impulso di carico (serie equispaziata 1 giorno).
 * Forma usata in prodotto: S_t = S_{t-1} * k + x_t * (1 - k), con k = exp(-1/τ), τ in giorni.
 * Non equivale a nessuna metrica commerciale omonima: è una scelta Empathy documentata.
 */
export const DEFAULT_ATL_TAU_DAYS = 7;
export const DEFAULT_CTL_TAU_DAYS = 42;

/** Fattore di persistenza EWMA da costante di tempo τ in giorni (passo 1 giorno). */
export function ewmaRetentionFromTauDays(tauDays: number): number {
  if (!Number.isFinite(tauDays) || tauDays <= 0) {
    throw new RangeError(`ewmaRetentionFromTauDays: tauDays must be finite and > 0, got ${tauDays}`);
  }
  return Math.exp(-1 / tauDays);
}

/**
 * Passo EWMA scalare: stato precedente S, impulso oggi x, τ in giorni.
 * Ritorna S*k + x*(1-k) con k = exp(-1/τ).
 */
export function ewmaDailyStep(prevSmoothed: number, dailyImpulse: number, tauDays: number): number {
  const k = ewmaRetentionFromTauDays(tauDays);
  return prevSmoothed * k + dailyImpulse * (1 - k);
}
