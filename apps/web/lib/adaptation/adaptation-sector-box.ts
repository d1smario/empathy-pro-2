/** Effetto stimolo/seduta sul settore vs contesto atleta che modula la via (cibo, integratori, laboratorio). */
export type AdaptationSectorPillDirection = "forward" | "reverse";

export type AdaptationSectorPillVm = {
  id: string;
  text: string;
  direction: AdaptationSectorPillDirection;
};

/** Dato per una casella della striscia settori (UI compatta, dettaglio in tendina). */
export type AdaptationSectorBoxVm = {
  id: string;
  shortLabel: string;
  valueLine: string;
  detailLine: string;
  /** Sintesi aggiuntiva: → effetto stimolo · ← contesto che modula. */
  pills?: AdaptationSectorPillVm[];
};
