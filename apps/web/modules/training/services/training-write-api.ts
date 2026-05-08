import type { TrainingPlannerCalendarReplaceInput, TrainingPlannerCalendarReplaceResult } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";

export async function replaceTrainingPlannerCalendar(
  input: TrainingPlannerCalendarReplaceInput,
): Promise<TrainingPlannerCalendarReplaceResult> {
  const response = await fetch("/api/training/planned", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      athleteId: input.athleteId,
      replaceTag: input.replaceTag,
      rows: input.rows,
      generationAudit: input.generationAudit,
    }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Replace VIRYA planned workouts failed");
  }
  return (await response.json()) as TrainingPlannerCalendarReplaceResult;
}
