import { formatPlannedWorkoutTitle, type PlannedWorkout } from "@empathy/domain-training";
import {
  effectiveDurationMinutesFromPro2Contract,
  effectiveTssDisplayFromPro2Contract,
  parsePro2BuilderSessionFromNotes,
} from "@/lib/training/builder/pro2-session-notes";

/**
 * Titolo lista/card: nome da `BUILDER_SESSION_JSON` se presente, altrimenti tipo DB;
 * durata e TSS dal contratto (blocchi reali) se possibile.
 */
export function formatPlannedWorkoutCardTitle(workout: PlannedWorkout): string {
  const contract = parsePro2BuilderSessionFromNotes(workout.notes ?? null);
  if (contract) {
    const name = contract.sessionName?.trim() || workout.type;
    const min = effectiveDurationMinutesFromPro2Contract(contract, workout.durationMinutes);
    const tss = effectiveTssDisplayFromPro2Contract(contract, workout.tssTarget);
    return `${name} · ${min}′ · TSS ${tss}`;
  }
  return formatPlannedWorkoutTitle(workout);
}
