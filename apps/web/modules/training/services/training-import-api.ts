"use client";

import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

/** Sotto ~3 MB resta il multipart verso `/api/training/import` (tetto Vercel ~4.5 MB). Sopra: upload diretto a Supabase Storage. */
const TRAINING_IMPORT_VERCEL_SAFE_MULTIPART_BYTES = 3 * 1024 * 1024;

export type TrainingImportFileResult = {
  status?: string;
  imported?: Record<string, unknown> | null;
  athleteMemory?: unknown;
  athleteMemoryError?: string;
  ingestion?: unknown;
  parsed?: Record<string, unknown> | null;
  visibilityCheck?: { athlete_id: string; date: string };
  importJobId?: string | null;
  structured?: boolean;
  structuredFormat?: string;
  firstDate?: string | null;
  importedCount?: number;
  structuredCompanion?: { status: string; message?: string; mode?: string; reason?: string };
  detectedKind?: "program" | "executed";
  routeReason?: string;
};

type TrainingImportSignOk = { bucket: string; path: string; token: string };

async function requestTrainingImportSignUrl(input: { athleteId: string; file: File }): Promise<TrainingImportSignOk> {
  const res = await fetch("/api/training/import/sign-upload", {
    method: "POST",
    headers: {
      ...(await buildSupabaseAuthHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      athleteId: input.athleteId,
      fileName: input.file.name,
      contentType: input.file.type || "application/octet-stream",
      fileSizeBytes: input.file.size,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    bucket?: string;
    path?: string;
    token?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? "Firma upload Storage non riuscita");
  }
  if (!json.bucket || !json.path || !json.token) {
    throw new Error("Risposta sign-upload non valida");
  }
  return { bucket: json.bucket, path: json.path, token: json.token };
}

async function pushStagingAndImportJson(input: {
  athleteId: string;
  file: File;
  sign: TrainingImportSignOk;
  date?: string;
  plannedDate?: string;
  notes?: string;
  device?: string;
  plannedWorkoutId?: string;
  importIntent: "executed" | "auto" | "planned";
}): Promise<unknown> {
  const sb = createEmpathyBrowserSupabase();
  if (!sb) {
    throw new Error("Client Supabase non disponibile (env pubblico mancante)");
  }
  const { error: upErr } = await sb.storage
    .from(input.sign.bucket)
    .uploadToSignedUrl(input.sign.path, input.sign.token, input.file);
  if (upErr) {
    throw new Error(upErr.message || "Upload Storage fallito");
  }

  const res = await fetch("/api/training/import", {
    method: "POST",
    headers: {
      ...(await buildSupabaseAuthHeaders()),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      athleteId: input.athleteId,
      storage: { bucket: input.sign.bucket, objectPath: input.sign.path },
      fileName: input.file.name,
      mimeType: input.file.type || "application/octet-stream",
      fileSizeBytes: input.file.size,
      date: input.date,
      plannedDate: input.plannedDate,
      notes: input.notes,
      device: input.device,
      plannedWorkoutId: input.plannedWorkoutId,
      importIntent: input.importIntent,
    }),
  });
  return { response: res, json: (await res.json().catch(() => ({}))) as { error?: string } };
}

export async function importExecutedWorkoutFile(input: {
  athleteId: string;
  file: File;
  date?: string;
  /** Giorno calendario per import strutturato in modalità auto/planned. */
  plannedDate?: string;
  notes?: string;
  device?: string;
  plannedWorkoutId?: string;
  /** Default `executed` — `auto` rileva FIT workout → PLAN. */
  importIntent?: "executed" | "auto";
}) {
  const intent = input.importIntent ?? "executed";

  if (input.file.size > TRAINING_IMPORT_VERCEL_SAFE_MULTIPART_BYTES) {
    const sign = await requestTrainingImportSignUrl({
      athleteId: input.athleteId,
      file: input.file,
    });
    const { response, json } = (await pushStagingAndImportJson({
      athleteId: input.athleteId,
      file: input.file,
      sign,
      date: input.date,
      plannedDate: input.plannedDate ?? input.date,
      notes: input.notes,
      device: input.device,
      plannedWorkoutId: input.plannedWorkoutId,
      importIntent: intent,
    })) as { response: Response; json: { error?: string } };
    if (!response.ok) {
      throw new Error(json.error ?? "Import eseguito non riuscito");
    }
    return json as TrainingImportFileResult;
  }

  const form = new FormData();
  form.set("athleteId", input.athleteId);
  form.set("file", input.file);
  form.set("importIntent", intent);
  if (input.date) form.set("date", input.date);
  if (input.plannedDate ?? input.date) form.set("plannedDate", input.plannedDate ?? input.date ?? "");
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
  return json as TrainingImportFileResult;
}

export async function importPlannedProgramFile(input: {
  athleteId: string;
  file: File;
  notes?: string;
  /** Giorno calendario per import strutturato (ZWO/ERG/MRC/FIT workout); per CSV/JSON tabellare le date sono nel file. */
  date?: string;
}) {
  if (input.file.size > TRAINING_IMPORT_VERCEL_SAFE_MULTIPART_BYTES) {
    const sign = await requestTrainingImportSignUrl({
      athleteId: input.athleteId,
      file: input.file,
    });
    const { response, json } = (await pushStagingAndImportJson({
      athleteId: input.athleteId,
      file: input.file,
      sign,
      date: input.date,
      notes: input.notes,
      importIntent: "planned",
    })) as { response: Response; json: { error?: string } };
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
