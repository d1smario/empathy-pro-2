/**
 * Blocco 1 — Forza & conditioning (V1 parity: Gym, Hyrox, CrossFit, Powerlifting).
 * Tag catalogo unificato per `sportTag` API.
 */
import type { Block1MusclePreset } from "@/lib/training/exercise-library/types";

export type Block1Discipline = "Gym" | "Hyrox" | "Crossfit" | "Powerlifting";

export const BLOCK1_STRENGTH_DISCIPLINES: Array<{
  id: Block1Discipline;
  sportTag: string;
  label: string;
  hint: string;
}> = [
  { id: "Gym", sportTag: "gym", label: "Gym", hint: "Macchine, bilateral push/pull, ipertrofia/forza generale" },
  { id: "Hyrox", sportTag: "hyrox", label: "Hyrox", hint: "Corse + erg + sled + farmer — endurance di forza" },
  { id: "Crossfit", sportTag: "crossfit", label: "CrossFit", hint: "WOD, mixed modal, skill + engine" },
  { id: "Powerlifting", sportTag: "powerlifting", label: "Powerlifting", hint: "SBD, tecnica, intensità specifica" },
];

/** Chiave palette Pro 2 (`sport` su `SPORT_MACRO_SECTORS`) → `sportTag` catalogo. */
export function pro2PaletteSportToBlock1SportTag(paletteSport: string): string {
  const key = paletteSport.trim().toLowerCase();
  const row = BLOCK1_STRENGTH_DISCIPLINES.find((d) => d.id.toLowerCase() === key || d.sportTag === key);
  return row?.sportTag ?? "gym";
}

export function disciplineToBlock1SportTag(discipline: string): string {
  const hit = BLOCK1_STRENGTH_DISCIPLINES.find((d) => d.id === discipline);
  return hit?.sportTag ?? "gym";
}

export const BLOCK1_MUSCLE_FILTERS: Array<{ value: Block1MusclePreset; label: string }> = [
  { value: "", label: "Tutto (dominio)" },
  { value: "lower", label: "Macro distretto · lower body" },
  { value: "upper_push", label: "Macro distretto · upper push" },
  { value: "upper_pull", label: "Macro distretto · upper pull" },
  { value: "quadriceps", label: "Quadricipiti" },
  { value: "hamstrings", label: "Femorali" },
  { value: "glutes", label: "Glutei" },
  { value: "calves", label: "Polpacci" },
  { value: "chest", label: "Petto" },
  { value: "lats", label: "Gran dorsale" },
  { value: "upper_back", label: "Schiena alta / trapezi" },
  { value: "shoulders", label: "Spalle" },
  { value: "biceps", label: "Bicipiti" },
  { value: "triceps", label: "Tricipiti" },
  { value: "forearms", label: "Avambracci / grip" },
  { value: "core", label: "Core" },
  { value: "hip_flexors", label: "Flessori anca" },
  { value: "posterior_chain", label: "Catena posteriore" },
  { value: "full", label: "Full body / conditioning" },
];
