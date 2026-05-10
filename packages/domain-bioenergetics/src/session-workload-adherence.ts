/**
 * Stima deterministica di potenza media da lavoro meccanico cumulativo (kJ) e durata:
 * P_avg = W / Δt = (kJ × 1000 J/kJ) / (min × 60 s/min) [W].
 *
 * Non è un modello fisiologico completo (non include efficienza meccanica/ciclismo vs corsa);
 * è un ancoraggio operativo per confrontare **target piano** (kj_target × durata) con tracce eseguite.
 *
 * Contesto energetico substrati / sistema fosfageno–glicolitico–ossidativo:
 * Gastin PB, "Energy system interaction and relative contribution during maximal exercise."
 * Sports Med. 2001;31(10):725-741. DOI: 10.2165/00007256-200131100-00003
 */
export function averagePowerWattsFromKjAndDuration(kj: number, durationMinutes: number): number | null {
  if (!Number.isFinite(kj) || kj <= 0) return null;
  const sec = durationMinutes * 60;
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return (kj * 1000) / sec;
}

/** kcal → kJ (fattore Atwater ~4.184 kJ/kcal), solo per assenza kj_target sul piano. */
export function kilojoulesFromKcal(kcal: number): number | null {
  if (!Number.isFinite(kcal) || kcal <= 0) return null;
  return kcal * 4.184;
}

/**
 * Rapporto carico eseguito / pianificato (Σ TSS). Utile per hint di aderenza senza giudizio clinico.
 * Impulse–response models (Banister / TRIMP lineage) usano carichi cumulativi per stress;
 * qui solo rapporto scalare operativo. Rif. metodologico carico interno: Banister EW et al.,
 * "A systems model of the effects of training on physical performance." MSSE 1975. DOI: 10.1249/00005768-197701000-00024
 */
export function tssPlanExecutionRatio(executedTssSum: number, plannedTssSum: number): number | null {
  if (!Number.isFinite(plannedTssSum) || plannedTssSum <= 0) return null;
  if (!Number.isFinite(executedTssSum) || executedTssSum < 0) return null;
  return executedTssSum / plannedTssSum;
}
