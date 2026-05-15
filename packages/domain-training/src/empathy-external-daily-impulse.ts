import { empathyCardioImpulseDailyFromSession } from "./empathy-cardio-impulse-daily";

/** Scala v0: cardio impulse → carico giornaliero confrontabile ordine-grandezza TSS (non equivalenza). */
const PSEUDO_TSS_FROM_CARDIO_SCALE = 10;
const MAX_PSEUDO_EXTERNAL_DAILY = 150;

/**
 * Contributo giornaliero al ramo EWMA "esterno" (ATL/CTL su serie caricamento).
 * Se `tss` > 0 usa TSS; altrimenti, se c’è FC e durata, stima da impulso cardiovascolare Empathy.
 * Per sport senza potenza canonica evita curva cronica/acuta piatta quando TSS non è riportato.
 */
export function empathyExternalDailyImpulseFromSession(input: {
  tss: number | null;
  durationMinutes: number;
  hrAvgBpm: number | null;
}): number {
  const tss = Math.max(0, Number(input.tss ?? 0));
  if (tss > 0) return tss;
  const cardio = empathyCardioImpulseDailyFromSession({
    durationMinutes: input.durationMinutes,
    hrAvgBpm: input.hrAvgBpm,
  });
  if (cardio <= 0) return 0;
  return Math.min(MAX_PSEUDO_EXTERNAL_DAILY, cardio * PSEUDO_TSS_FROM_CARDIO_SCALE);
}
