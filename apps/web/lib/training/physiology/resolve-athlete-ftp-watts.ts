import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

export function isUsableAthleteFtpWatts(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 40 && value < 600;
}

/**
 * FTP per energia seduta (kJ / kcal): **memoria fisiologica atleta attivo** prima del contratto salvato.
 * Nessun default 250 W — se manca FTP reale ritorna null e il caller usa fallback conservativo.
 */
export function resolveAthleteFtpWattsForSessionEnergy(input: {
  athleteFtpWatts?: number | null;
  contract?: Pro2BuilderSessionContract | null;
}): number | null {
  if (isUsableAthleteFtpWatts(input.athleteFtpWatts)) return Math.round(input.athleteFtpWatts);
  const fromContract = input.contract?.renderProfile?.ftpW;
  if (isUsableAthleteFtpWatts(fromContract)) return Math.round(fromContract);
  return null;
}
