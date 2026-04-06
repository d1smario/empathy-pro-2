"use client";

/**
 * Stesso contratto chiave di V1 (`nextjs-empathy-pro`) per atleta attivo coach / contesto UI.
 * Valore reale da DB arriverà in fasi successive; finché mancano API dominio, resta solo storage locale.
 */
export type AppRole = "private" | "coach";

const ACTIVE_ATHLETE_KEY = "empathy_active_athlete_id";

export function readActiveAthleteId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ATHLETE_KEY);
}

export function writeActiveAthleteId(athleteId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_ATHLETE_KEY, athleteId);
}

export function clearActiveAthleteId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_ATHLETE_KEY);
}
