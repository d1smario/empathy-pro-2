import { decompressTrainingImportBuffer } from "@/lib/training/import-parser";
import { csvHeaderLooksLikePlannedProgramExport, jsonTextLooksLikePlannedProgram } from "@/lib/training/planned-import-parser";
import type { FitWorkoutScanResult } from "@/lib/training/fit-workout-step-scan";
import {
  normalizeTrainingImportIntent,
  type TrainingImportIntent,
} from "@/lib/training/training-import-intent";

export type { TrainingImportIntent } from "@/lib/training/training-import-intent";
export { normalizeTrainingImportIntent } from "@/lib/training/training-import-intent";

/** Programma (blocchi/range) vs attività registrata (serie istantanee). */
export type TrainingImportDetectedKind = "program" | "executed";

export type TrainingImportResolvedRoute =
  | { kind: "executed_activity"; detectedKind: "executed"; routeReason: string }
  | { kind: "planned_program"; detectedKind: "program"; routeReason: string }
  | {
      kind: "planned_structured";
      format: "zwo" | "erg" | "mrc" | "fit_workout";
      detectedKind: "program";
      routeReason: string;
    };

function fileExtension(effectiveName: string): string {
  const base = effectiveName.split(/[/\\]/).pop() ?? effectiveName;
  const i = base.lastIndexOf(".");
  return i >= 0 ? base.slice(i + 1).toLowerCase() : "";
}

function scanFitWorkoutStepsFromBuffer(payload: Buffer): FitWorkoutScanResult {
  // Lazy via require(): evita di caricare la dipendenza binaria FIT in test
  // che coprono solo ZWO/CSV. Niente commenti `eslint-disable` qui: il monorepo
  // estende `next/core-web-vitals` senza caricare `@typescript-eslint/eslint-plugin`,
  // quindi citare regole `@typescript-eslint/*` farebbe failare il build (Vercel).
  const mod = require("@/lib/training/fit-workout-step-scan") as typeof import("@/lib/training/fit-workout-step-scan");
  return mod.scanFitWorkoutStepsFromBuffer(payload);
}

/**
 * True se il buffer FIT descrive un **programma** (workout_step / range), non un'attività con traccia densa.
 * Export TrainingPeaks/Garmin: step + hint sessione anche con record spuri nel file.
 */
export function fitPayloadLooksLikeWorkoutPlan(payload: Buffer): boolean {
  const scan = scanFitWorkoutStepsFromBuffer(payload);
  const hasSteps = scan.workoutSteps.length >= 1;

  if (hasSteps) {
    const tpWorkoutHints =
      scan.declaresWorkoutFileType || scan.sessionDurationHintsSec.length > 0;
    if (tpWorkoutHints) {
      /** Attività registrata con pochi step spurii: soglia alta sui record GPS/power. */
      if (scan.recordCount >= 150 && scan.workoutSteps.length < 2) return false;
      return true;
    }
    if (scan.recordCount <= 2) return true;
    if (scan.workoutSteps.length >= 2 && scan.recordCount < 40) return true;
    return scan.recordCount < 35;
  }

  if (scan.declaresWorkoutFileType && scan.recordCount < 30) return true;
  return false;
}

/** FIT programma esportabile come `planned_structured` (fit_workout). */
export function fitPayloadStructuredFormat(payload: Buffer): "fit_workout" | null {
  return fitPayloadLooksLikeWorkoutPlan(payload) ? "fit_workout" : null;
}

/**
 * Decide se il POST `/api/training/import` deve seguire il ramo eseguito, programma tabellare o seduta strutturata.
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
    if (ext === "fit" && fitPayloadLooksLikeWorkoutPlan(payload)) {
      return {
        kind: "planned_structured",
        format: "fit_workout",
        detectedKind: "program",
        routeReason: "fit_workout_steps",
      };
    }
    return { kind: "executed_activity", detectedKind: "executed", routeReason: "intent_executed" };
  }

  if (input.intent === "planned") {
    if (ext === "csv" || ext === "json") {
      return { kind: "planned_program", detectedKind: "program", routeReason: "tabular_calendar_export" };
    }
    if (ext === "zwo") {
      return { kind: "planned_structured", format: "zwo", detectedKind: "program", routeReason: "zwo_structured" };
    }
    if (ext === "erg") {
      return { kind: "planned_structured", format: "erg", detectedKind: "program", routeReason: "erg_structured" };
    }
    if (ext === "mrc") {
      return { kind: "planned_structured", format: "mrc", detectedKind: "program", routeReason: "mrc_structured" };
    }
    if (ext === "fit") {
      if (fitPayloadLooksLikeWorkoutPlan(payload)) {
        return {
          kind: "planned_structured",
          format: "fit_workout",
          detectedKind: "program",
          routeReason: "fit_workout_steps",
        };
      }
      throw new Error(
        "Questo file FIT sembra un'attività registrata, non un workout strutturato. Usa la modalità «Workout eseguito».",
      );
    }
    throw new Error(
      `Formato non supportato per programmazione coach: .${ext || "?"}. Usa CSV/JSON calendario, oppure ZWO / ERG / MRC / FIT workout.`,
    );
  }

  /* auto */
  if (ext === "zwo") {
    return { kind: "planned_structured", format: "zwo", detectedKind: "program", routeReason: "zwo_structured" };
  }
  if (ext === "erg") {
    return { kind: "planned_structured", format: "erg", detectedKind: "program", routeReason: "erg_structured" };
  }
  if (ext === "mrc") {
    return { kind: "planned_structured", format: "mrc", detectedKind: "program", routeReason: "mrc_structured" };
  }
  if (ext === "fit") {
    if (fitPayloadLooksLikeWorkoutPlan(payload)) {
      return {
        kind: "planned_structured",
        format: "fit_workout",
        detectedKind: "program",
        routeReason: "fit_workout_steps",
      };
    }
    return { kind: "executed_activity", detectedKind: "executed", routeReason: "fit_activity_trace" };
  }
  if (ext === "csv") {
    const firstLine = payload.toString("utf8").split(/\r?\n/).find((l) => l.trim()) ?? "";
    return csvHeaderLooksLikePlannedProgramExport(firstLine)
      ? { kind: "planned_program", detectedKind: "program", routeReason: "csv_calendar_export" }
      : { kind: "executed_activity", detectedKind: "executed", routeReason: "csv_activity_log" };
  }
  if (ext === "json") {
    return jsonTextLooksLikePlannedProgram(payload.toString("utf8"))
      ? { kind: "planned_program", detectedKind: "program", routeReason: "json_calendar_export" }
      : { kind: "executed_activity", detectedKind: "executed", routeReason: "json_activity_log" };
  }
  return { kind: "executed_activity", detectedKind: "executed", routeReason: "default_activity" };
}

/** Dopo parse EXEC: se durata 0 ma FIT ha step programma, convoglia su structured. */
export function fitStructuredFallbackAfterEmptyExecuted(input: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  durationMinutes: number;
  intent: TrainingImportIntent;
}): { format: "fit_workout"; routeReason: string } | null {
  if (input.intent !== "auto") return null;
  if ((input.durationMinutes ?? 0) > 0) return null;
  const { payload } = decompressTrainingImportBuffer({
    fileName: input.fileName,
    mimeType: input.mimeType,
    buffer: input.buffer,
  });
  if (fileExtension(input.fileName) !== "fit") return null;
  if (!fitPayloadLooksLikeWorkoutPlan(payload)) return null;
  return { format: "fit_workout", routeReason: "auto_fallback_empty_executed_fit_workout" };
}
