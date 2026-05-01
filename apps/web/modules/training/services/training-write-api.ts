import type {
  TrainingPlannerCalendarReplaceInput,
  TrainingPlannerCalendarReplaceResult,
  TrainingPlannerCalendarRow,
} from "@/api/training/contracts";
import type { AthleteMemory, RealityIngestionEnvelope } from "@/lib/empathy/schemas";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";

type PlannedWorkoutWrite = TrainingPlannerCalendarRow;

export async function createPlannedWorkout(row: PlannedWorkoutWrite) {
  const response = await fetch("/api/training/planned", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ row }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Create planned workout failed");
  }
  return (await response.json()) as { status: "ok"; athleteMemory?: AthleteMemory | null };
}

export async function createExecutedWorkout(row: {
  athlete_id: string;
  date: string;
  duration_minutes: number;
  tss: number;
  kcal: number | null;
  subjective_notes: string | null;
  source: string;
  planned_workout_id: string | null;
}) {
  const response = await fetch("/api/training/executed", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Create executed workout failed");
  }
  return (await response.json()) as { status: "ok"; athleteMemory?: AthleteMemory | null };
}

export async function updatePlannedWorkout(input: {
  id: string;
  athleteId: string;
  patch: Partial<PlannedWorkoutWrite>;
}) {
  const response = await fetch("/api/training/planned", {
    method: "PATCH",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Update planned workout failed");
  }
  return (await response.json()) as { status: "ok"; athleteMemory?: AthleteMemory | null };
}

export async function deletePlannedWorkout(input: { id: string; athleteId: string }) {
  const body = { id: input.id.trim(), athleteId: input.athleteId.trim() };
  if (!body.athleteId) throw new Error("athleteId required for deletePlannedWorkout");
  const response = await fetch("/api/training/planned", {
    method: "DELETE",
    headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; errorCode?: string };
    const probe = response.headers.get("x-empathy-delete-probe");
    const extra = [payload.errorCode, probe].filter(Boolean).join(" · ");
    throw new Error([payload.error ?? "Delete planned workout failed", extra].filter(Boolean).join(" — "));
  }
  return (await response.json()) as { status: "ok"; athleteMemory?: AthleteMemory | null };
}

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

export async function importExecutedWorkoutFile(input: {
  athleteId: string;
  file: File;
  date?: string;
  notes?: string;
  device?: string;
  plannedWorkoutId?: string;
}) {
  const form = new FormData();
  form.set("athleteId", input.athleteId);
  form.set("file", input.file);
  if (input.date) form.set("date", input.date);
  if (input.notes) form.set("notes", input.notes);
  if (input.device) form.set("device", input.device);
  if (input.plannedWorkoutId) form.set("plannedWorkoutId", input.plannedWorkoutId);

  const response = await fetch("/api/training/import", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders(),
    body: form,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Import executed workout failed");
  }
  return (await response.json()) as {
    status: "ok";
    imported?: Record<string, unknown> | null;
    parsed?: Record<string, unknown> | null;
    visibilityCheck?: Record<string, unknown> | null;
    importJobId?: string | null;
    ingestion?: RealityIngestionEnvelope | null;
    athleteMemory?: AthleteMemory | null;
  };
}
