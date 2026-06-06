/**
 * Stime g/h CHO e FAT da potenza media (allineato a critical-power-engine substrateTable).
 * PRO g/h: banda evidence endurance opzionale (non Frayn).
 */

const DEFAULT_EFFICIENCY = 0.24;
const DEFAULT_FTP_W = 250;

export type SubstrateRatesPerHour = {
  choGPerH: number;
  fatGPerH: number;
  proGPerH: number;
  rer: number;
  kcalPerH: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round(n: number, d = 1): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** RER stimato da intensità % FTP (semplificato, coerente con CP engine). */
function rerFromIntensityPctFtp(intensityPctFtp: number): number {
  const i = clamp(intensityPctFtp, 40, 120);
  if (i < 60) return 0.82;
  if (i < 75) return 0.88;
  if (i < 85) return 0.92;
  if (i < 95) return 0.96;
  return 1.02;
}

export function substrateRatesAtPowerW(
  avgPowerW: number,
  options?: { ftpW?: number; efficiency?: number; proteinGPerH?: number },
): SubstrateRatesPerHour {
  const ftp = Math.max(120, options?.ftpW ?? DEFAULT_FTP_W);
  const efficiency = options?.efficiency ?? DEFAULT_EFFICIENCY;
  const intensityPctFtp = (avgPowerW / ftp) * 100;
  const rer = rerFromIntensityPctFtp(intensityPctFtp);
  const choFrac = clamp((rer - 0.7) / 0.3, 0.05, 0.99);
  const fatFrac = 1 - choFrac;
  const kcalPerH = (avgPowerW / efficiency) * 3600 / 4184;
  const choGPerH = (kcalPerH * choFrac) / 4;
  const fatGPerH = (kcalPerH * fatFrac) / 9;
  const proGPerH = options?.proteinGPerH ?? clamp(0.08 * (avgPowerW / 100), 2, 12);
  return {
    choGPerH: round(choGPerH),
    fatGPerH: round(fatGPerH),
    proGPerH: round(proGPerH),
    rer: round(rer, 2),
    kcalPerH: round(kcalPerH),
  };
}

export function substrateTotalsForSession(
  avgPowerW: number,
  durationMinutes: number,
  options?: { ftpW?: number; efficiency?: number; proteinGPerH?: number },
): SubstrateRatesPerHour & { durationH: number; choG: number; fatG: number; proG: number } {
  const durationH = Math.max(0.05, durationMinutes / 60);
  const perH = substrateRatesAtPowerW(avgPowerW, options);
  return {
    ...perH,
    durationH: round(durationH, 2),
    choG: round(perH.choGPerH * durationH),
    fatG: round(perH.fatGPerH * durationH),
    proG: round(perH.proGPerH * durationH),
  };
}
