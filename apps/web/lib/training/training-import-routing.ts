import "server-only";

import { decompressTrainingImportBuffer } from "@/lib/training/import-parser";
import { csvHeaderLooksLikePlannedProgramExport, jsonTextLooksLikePlannedProgram } from "@/lib/training/planned-import-parser";
import { scanFitWorkoutStepsFromBuffer } from "@/lib/training/fit-workout-step-scan";

export type TrainingImportIntent = "auto" | "executed" | "planned";

export type TrainingImportResolvedRoute =
  | { kind: "executed_activity" }
  | { kind: "planned_program" }
  | { kind: "planned_structured"; format: "zwo" | "erg" | "mrc" | "fit_workout" };

function fileExtension(effectiveName: string): string {
  const base = effectiveName.split(/[/\\]/).pop() ?? effectiveName;
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i + 1).toLowerCase() : "";
}

/**
 * True se il buffer è un FIT «workout» (step + pochi record) e non un’attività registrata.
 * Nota: `fit-file-parser` in list mode tiene un solo `workout_step` sull’oggetto; usiamo `scanFitWorkoutStepsFromBuffer`.
 */
function fitPayloadLooksLikeWorkoutPlan(payload: Buffer): boolean {
  const scan = scanFitWorkoutStepsFromBuffer(payload);
  if (scan.workoutSteps.length >= 1) {
    if (scan.recordCount <= 2) return true;
    if (scan.workoutSteps.length >= 2 && scan.recordCount < 40) return true;
    return scan.recordCount < 35;
  }
  if (scan.declaresWorkoutFileType && scan.recordCount < 30) return true;
  return false;
}

export function normalizeTrainingImportIntent(raw: unknown): TrainingImportIntent {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "planned" || s === "plan") return "planned";
  if (s === "auto") return "auto";
  return "executed";
}

/**
 * Decide se il POST `/api/training/import` deve seguire il ramo eseguito, programma tabellare o seduta strutturata.
 * `buffer` è quello originale upload (gestione `.gz` interna).
 */
export function resolveTrainingImportRoute(input: {
  intent: TrainingImportIntent;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): TrainingImportResolvedRoute {
  const { effectiveName, payload } = decompressTrainingImportBuffer({
    fileName: input.fileName,
    mimeType: input.mimeType,
    buffer: input.buffer,
  });
  const ext = fileExtension(effectiveName);

  if (input.intent === "executed") {
    return { kind: "executed_activity" };
  }

  if (input.intent === "planned") {
    if (ext === "csv" || ext === "json") return { kind: "planned_program" };
    if (ext === "zwo") return { kind: "planned_structured", format: "zwo" };
    if (ext === "erg") return { kind: "planned_structured", format: "erg" };
    if (ext === "mrc") return { kind: "planned_structured", format: "mrc" };
    if (ext === "fit") {
      const w = fitPayloadLooksLikeWorkoutPlan(payload);
      if (w) return { kind: "planned_structured", format: "fit_workout" };
      throw new Error(
        "Questo file FIT sembra un'attività registrata, non un workout strutturato. Usa la modalità «Workout eseguito».",
      );
    }
    throw new Error(
      `Formato non supportato per programmazione coach: .${ext || "?"}. Usa CSV/JSON calendario, oppure ZWO / ERG / MRC / FIT workout.`,
    );
  }

  /* auto */
  if (ext === "zwo") return { kind: "planned_structured", format: "zwo" };
  if (ext === "erg") return { kind: "planned_structured", format: "erg" };
  if (ext === "mrc") return { kind: "planned_structured", format: "mrc" };
  if (ext === "fit") {
    return fitPayloadLooksLikeWorkoutPlan(payload)
      ? { kind: "planned_structured", format: "fit_workout" }
      : { kind: "executed_activity" };
  }
  if (ext === "csv") {
    const firstLine = payload.toString("utf8").split(/\r?\n/).find((l) => l.trim()) ?? "";
    return csvHeaderLooksLikePlannedProgramExport(firstLine)
      ? { kind: "planned_program" }
      : { kind: "executed_activity" };
  }
  if (ext === "json") {
    return jsonTextLooksLikePlannedProgram(payload.toString("utf8"))
      ? { kind: "planned_program" }
      : { kind: "executed_activity" };
  }
  return { kind: "executed_activity" };
}
