import { buildAcuteMealMetabolicEstimate, type ActivityState } from "@empathy/domain-nutrition";
import type { AcuteMealMetabolicEstimate, PhysiologyState } from "@/lib/empathy/schemas";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapActivityState(context: TrainingDayOperationalContext | null | undefined): ActivityState {
  if (!context) return "rest";
  if (context.mode === "protective") return "rest";
  if (context.mode === "cautious") return "easy";
  if (context.loadScale > 0.98) return "tempo";
  return "easy";
}

export function resolveAcuteMealEstimateFromDiary(input: {
  athleteId: string;
  diaryRows: Array<Record<string, unknown>>;
  physiologyState: PhysiologyState | null | undefined;
  operationalContext: TrainingDayOperationalContext | null | undefined;
}): AcuteMealMetabolicEstimate | null {
  const latest = input.diaryRows[0];
  if (!latest) return null;
  const carbsG = asNumber(latest.carbs_g);
  if (carbsG == null || carbsG <= 0) return null;

  const entryDate = typeof latest.entry_date === "string" ? latest.entry_date.slice(0, 10) : "";
  const entryTime = typeof latest.entry_time === "string" ? latest.entry_time.slice(0, 8) : "";
  const intakeAt = entryDate ? `${entryDate}T${entryTime || "12:00:00"}Z` : null;
  const mealSlot =
    typeof latest.meal_slot === "string" &&
    ["breakfast", "lunch", "dinner", "snack", "other"].includes(latest.meal_slot)
      ? (latest.meal_slot as AcuteMealMetabolicEstimate["context"]["mealSlot"])
      : "other";

  return buildAcuteMealMetabolicEstimate({
    athleteId: input.athleteId,
    carbsIngestedG: carbsG,
    mealSlot,
    intakeAt,
    baselineGlucoseMmol: input.physiologyState?.physiologicalProfile.baselineGlucoseMmol ?? null,
    gutStressScorePct: (input.physiologyState?.lactateProfile.gutStressScore ?? 0) * 100,
    activityState: mapActivityState(input.operationalContext),
  });
}
