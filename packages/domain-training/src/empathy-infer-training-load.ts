import { empathyExternalDailyImpulseFromSession } from "./empathy-external-daily-impulse";

export const EMPATHY_LOAD_METHOD_VERSION = "EMPATHY_LOAD_V2_2026_05" as const;

const MAX_TRAINING_LOAD = 999;
const MAX_HR_PROXY_LOAD = 150;
const DURATION_ONLY_CAP = 40;

/** Coggan semplificato: ore × (P/FTP)² × 100. */
export function trainingLoadFromPowerSession(input: {
  durationMinutes: number;
  avgPowerW: number;
  ftpW: number;
}): number {
  const ftp = Math.max(1, input.ftpW);
  const hours = Math.max(0, input.durationMinutes) / 60;
  const ifN = Math.max(0, input.avgPowerW) / ftp;
  return Math.round(Math.min(MAX_TRAINING_LOAD, Math.max(0, hours * ifN * ifN * 100)));
}

/**
 * Carico di lavoro per singola seduta (label prodotto: Training load).
 * Ordine: vendor → potenza/FTP → FC → durata conservativa.
 */
export function inferEmpathyTrainingLoadForSession(input: {
  vendorLoad?: number | null;
  durationMinutes: number;
  hrAvgBpm?: number | null;
  avgPowerW?: number | null;
  ftpW?: number | null;
}): number {
  const vendor = Number(input.vendorLoad ?? 0);
  if (Number.isFinite(vendor) && vendor > 0) {
    return Math.round(Math.min(MAX_TRAINING_LOAD, vendor));
  }

  const dur = Math.max(0, input.durationMinutes);
  const ftp = input.ftpW;
  const power = input.avgPowerW;
  if (
    ftp != null &&
    Number.isFinite(ftp) &&
    ftp > 0 &&
    power != null &&
    Number.isFinite(power) &&
    power > 0 &&
    dur > 0
  ) {
    return trainingLoadFromPowerSession({ durationMinutes: dur, avgPowerW: power, ftpW: ftp });
  }

  const hrProxy = empathyExternalDailyImpulseFromSession({
    tss: 0,
    durationMinutes: dur,
    hrAvgBpm: input.hrAvgBpm ?? null,
  });
  if (hrProxy > 0) return Math.round(Math.min(MAX_HR_PROXY_LOAD, hrProxy));

  if (dur > 0) {
    return Math.round(Math.min(DURATION_ONLY_CAP, dur * 0.45));
  }
  return 0;
}
