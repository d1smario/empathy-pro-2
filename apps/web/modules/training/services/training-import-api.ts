"use client";

import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";

export async function importExecutedWorkoutFile(input: {
  athleteId: string;
  file: File;
  date?: string;
  notes?: string;
  device?: string;
  plannedWorkoutId?: string;
  /** Default `executed` — for import tabellare / strutturato usare `importPlannedProgramFile`. */
  importIntent?: "executed" | "auto";
}) {
  const form = new FormData();
  form.set("athleteId", input.athleteId);
  form.set("file", input.file);
  form.set("importIntent", input.importIntent ?? "executed");
  if (input.date) form.set("date", input.date);
  if (input.notes) form.set("notes", input.notes);
  if (input.device) form.set("device", input.device);
  if (input.plannedWorkoutId) form.set("plannedWorkoutId", input.plannedWorkoutId);

  const response = await fetch("/api/training/import", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders(),
    body: form,
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(json.error ?? "Import eseguito non riuscito");
  }
  return json as {
    status: "ok";
    imported?: Record<string, unknown> | null;
    athleteMemory?: unknown;
    athleteMemoryError?: string;
    ingestion?: unknown;
    parsed?: Record<string, unknown> | null;
    visibilityCheck?: { athlete_id: string; date: string };
    importJobId?: string | null;
  };
}

export async function importPlannedProgramFile(input: {
  athleteId: string;
  file: File;
  notes?: string;
  /** Giorno calendario per import strutturato (ZWO/ERG/MRC/FIT workout); per CSV/JSON tabellare le date sono nel file. */
  date?: string;
}) {
  const form = new FormData();
  form.set("athleteId", input.athleteId);
  form.set("file", input.file);
  form.set("importIntent", "planned");
  if (input.notes) form.set("notes", input.notes);
  if (input.date) form.set("date", input.date);

  const response = await fetch("/api/training/import", {
    method: "POST",
    headers: await buildSupabaseAuthHeaders(),
    body: form,
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(json.error ?? "Import programma non riuscito");
  }
  return json as {
    status?: string;
    athleteMemory?: unknown;
    athleteMemoryError?: string;
    ingestion?: unknown;
    importedCount?: number;
    firstDate?: string | null;
    sourceFormat?: string | null;
    fileName?: string | null;
    importJobId?: string | null;
    structured?: boolean;
    structuredFormat?: string;
    structuredCompanion?: { status: string; message?: string; mode?: string; reason?: string };
    intervalLadder?: Array<{
      index: number;
      durationSec: number;
      powerAvgW: number;
      powerLowW: number;
      powerHighW: number;
      durationType: string;
      kind: string;
      label?: string;
    }>;
    intervalLadderCsv?: string;
  };
}
