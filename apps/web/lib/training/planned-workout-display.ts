import type { PlannedWorkout } from "@empathy/domain-training";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { parsePro2BuilderSessionFromNotes } from "@/lib/training/builder/pro2-session-notes";
import type { SportGlyphId } from "@/lib/training/builder/sport-glyph-id";
import { resolveSportGlyphFromSportString } from "@/lib/training/session-detail-summary";

export function parsePlannedWorkoutContract(workout: PlannedWorkout): Pro2BuilderSessionContract | null {
  return parsePro2BuilderSessionFromNotes(workout.notes ?? null);
}

export function contractHasGymScheda(contract: Pro2BuilderSessionContract): boolean {
  return (contract.blocks ?? []).some((b) => Boolean(b.gymRx?.catalogExerciseId));
}

export function resolvePlannedWorkoutSportGlyph(workout: PlannedWorkout): SportGlyphId | null {
  const contract = parsePlannedWorkoutContract(workout);
  if (contract?.family === "strength") return "gym";
  if (contract?.family === "lifestyle") {
    const d = (contract.discipline ?? workout.type ?? "").toLowerCase();
    if (d.includes("yoga")) return "yoga";
    if (d.includes("pilates")) return "pilates";
    if (d.includes("breath")) return "breath";
    if (d.includes("meditation")) return "meditation";
    if (d.includes("stretch")) return "stretch";
    return "mobility";
  }
  const sport = contract?.discipline ?? contract?.sessionName ?? workout.type ?? "";
  return resolveSportGlyphFromSportString(sport);
}

export function uniquePlannedSportGlyphs(workouts: PlannedWorkout[], max = 4): SportGlyphId[] {
  const out: SportGlyphId[] = [];
  for (const w of workouts) {
    const g = resolvePlannedWorkoutSportGlyph(w);
    if (!g || out.includes(g)) continue;
    out.push(g);
    if (out.length >= max) break;
  }
  return out;
}
