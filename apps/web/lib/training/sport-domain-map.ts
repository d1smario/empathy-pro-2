import type { TrainingDomain } from "@/lib/training/engine/types";
import { SPORT_MACRO_SECTORS, type SportMacroId } from "@/lib/training/builder/sport-macro-palette";

/**
 * Dominio motore (`generateTrainingSession`) per ogni sport della palette macro A–D.
 * Allineato a `SPORT_MACRO_SECTORS`: B gym/hyrox/crossfit, C team/combat, D mind_body.
 */
function domainForMacroSport(macroId: SportMacroId, sportLower: string): TrainingDomain {
  if (macroId === "aerobic") return "endurance";
  if (macroId === "strength") {
    if (sportLower === "hyrox") return "hyrox";
    if (sportLower === "crossfit") return "crossfit";
    return "gym";
  }
  if (macroId === "technical") {
    if (["boxing", "karate", "judo", "muay thai"].includes(sportLower)) return "combat";
    return "team_sport";
  }
  if (macroId === "lifestyle") return "mind_body";
  return "endurance";
}

/** Risolve il dominio se `sport` è una chiave esatta della palette builder/Vyria. */
export function trainingDomainForPaletteSport(sport: string): TrainingDomain | null {
  const s = sport.trim().toLowerCase();
  for (const macro of SPORT_MACRO_SECTORS) {
    if (macro.sports.some((c) => c.sport.toLowerCase() === s)) {
      return domainForMacroSport(macro.id, s);
    }
  }
  return null;
}
