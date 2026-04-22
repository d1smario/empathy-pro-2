import "server-only";

/**
 * fit-file-parser in mode `list` sovrascrive `fitObj.workout_step` ad ogni messaggio (vedi `dist/fit-parser.js` default branch).
 * Per import programmato FIT serve l’elenco completo degli step: replichiamo il loop binario usando `readRecord` esportato.
 * Import tramite alias webpack (`next.config.mjs`): il package non esporta `./dist/binary.js`.
 */
import { calculateCRC, getArrayBuffer, readRecord } from "empathy-fit-file-parser-binary";

const READ_OPTIONS = {
  force: true,
  speedUnit: "km/h",
  lengthUnit: "m",
  temperatureUnit: "celsius",
  elapsedRecordField: true,
  pressureUnit: "bar",
  mode: "list",
} as const;

export type FitWorkoutScanResult = {
  workoutSteps: Record<string, unknown>[];
  /** Ultimo messaggio `workout` nel file (sport, nome, num_valid_steps). */
  workout: Record<string, unknown> | null;
  /**
   * Durate «macro» (secondi) da messaggi non mappati nel profilo statico (es. `workout_session`, developer):
   * TrainingPeaks a volte ripete step corti ma mette il totale reale qui.
   */
  sessionDurationHintsSec: number[];
  recordCount: number;
  fileIds: Record<string, unknown>[];
  /** True se almeno un `file_id` dichiara type workout (Garmin / TP export). */
  declaresWorkoutFileType: boolean;
};

function asFitScanNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Estrae secondi plausibili (40 min – 14 h) da campi tipo sessione / export.
 * Messaggi senza `name` nel profilo fit-file-parser finiscono in `default` con payload comunque decodificato.
 */
export function extractSessionDurationHintSec(m: Record<string, unknown> | null | undefined): number | null {
  if (!m || typeof m !== "object") return null;
  const keys = [
    "total_timer_time",
    "totalTimerTime",
    "total_elapsed_time",
    "totalElapsedTime",
    "time_duration",
    "timeDuration",
    "planned_time",
    "plannedTime",
  ];
  let best: number | null = null;
  for (const k of keys) {
    const v = asFitScanNumber(m[k]);
    if (v == null || v <= 0) continue;
    const candidates: number[] = [];
    if (v >= 500_000) candidates.push(v / 1000);
    if (v >= 40 * 60 && v <= 14 * 3600) candidates.push(v);
    if (Number.isInteger(v) && v >= 45 && v <= 420) candidates.push(v * 60);
    for (const sec of candidates) {
      if (sec >= 40 * 60 && sec <= 14 * 3600) {
        best = best == null ? sec : Math.max(best, sec);
      }
    }
  }
  return best;
}

function fitBounds(blob: Uint8Array): { headerLength: number; crcStart: number } | null {
  if (blob.length < 12) return null;
  const headerLength = blob[0];
  if (headerLength !== 14 && headerLength !== 12) return null;
  let fileTypeString = "";
  for (let i = 8; i < 12; i++) {
    fileTypeString += String.fromCharCode(blob[i]!);
  }
  if (fileTypeString !== ".FIT") return null;
  if (headerLength === 14) {
    const crcHeader = blob[12]! + (blob[13]! << 8);
    const crcHeaderCalc = calculateCRC(blob, 0, 12);
    if (crcHeader !== crcHeaderCalc) {
      /* come fit-parser: con force si continua */
    }
  }
  const dataLength = blob[4]! + (blob[5]! << 8) + (blob[6]! << 16) + (blob[7]! << 24);
  const crcStart = dataLength + headerLength;
  const crcFile = blob[crcStart]! + (blob[crcStart + 1]! << 8);
  const crcFileCalc = calculateCRC(blob, headerLength === 12 ? 0 : headerLength, crcStart);
  if (crcFile !== crcFileCalc) {
    /* force: continua */
  }
  return { headerLength, crcStart };
}

function fileIdsDeclareWorkout(fileIds: Record<string, unknown>[]): boolean {
  for (const row of fileIds) {
    const t = row?.type;
    if (t === "workout") return true;
  }
  return false;
}

/**
 * Scansiona un buffer FIT (già decompresso se era .gz) e raccoglie tutti i `workout_step`.
 */
export function scanFitWorkoutStepsFromBuffer(buffer: Buffer): FitWorkoutScanResult {
  const workoutSteps: Record<string, unknown>[] = [];
  let lastWorkout: Record<string, unknown> | null = null;
  const sessionDurationHintsSec: number[] = [];
  const file_ids: Record<string, unknown>[] = [];
  let recordCount = 0;

  try {
    const blob = new Uint8Array(getArrayBuffer(buffer));
    const bounds = fitBounds(blob);
    if (!bounds) {
      return {
        workoutSteps: [],
        workout: null,
        sessionDurationHintsSec: [],
        recordCount: 0,
        fileIds: [],
        declaresWorkoutFileType: false,
      };
    }
    const { headerLength, crcStart } = bounds;

    const messageTypes: unknown[] = [];
    const developerFields: unknown[] = [];
    let loopIndex = headerLength;
    let startDate: unknown;
    let lastStopTimestamp: number | undefined;
    let pausedTime = 0;

    while (loopIndex < crcStart) {
      const { nextIndex, messageType, message } = readRecord(
        blob,
        messageTypes,
        developerFields,
        loopIndex,
        READ_OPTIONS,
        startDate,
        pausedTime,
      );
      loopIndex = nextIndex;

      switch (messageType) {
        case "event":
          if (message?.event === "timer") {
            if (message.event_type === "stop_all") {
              lastStopTimestamp =
                typeof message.timestamp === "number" ? message.timestamp : Number(message.timestamp);
            } else if (message.event_type === "start" && lastStopTimestamp != null) {
              const ts =
                typeof message.timestamp === "number" ? message.timestamp : Number(message.timestamp);
              if (Number.isFinite(ts)) pausedTime += (ts - lastStopTimestamp) / 1000;
            }
          }
          break;
        case "record":
          if (!startDate) {
            startDate = message.timestamp;
          }
          recordCount += 1;
          break;
        case "file_id":
          if (message) file_ids.push(message as Record<string, unknown>);
          break;
        case "workout":
          if (message && typeof message === "object") {
            lastWorkout = message as Record<string, unknown>;
          }
          break;
        case "workout_step":
          if (message && typeof message === "object") {
            workoutSteps.push(message as Record<string, unknown>);
          }
          break;
        case "session":
          if (message && typeof message === "object") {
            const h = extractSessionDurationHintSec(message as Record<string, unknown>);
            if (h != null) sessionDurationHintsSec.push(h);
          }
          break;
        default: {
          /* Profilo statico senza nome (es. global 158 workout_session): qui spesso c’è il tempo totale TP. */
          if (message && typeof message === "object" && (messageType === "" || messageType === "unknown")) {
            const h = extractSessionDurationHintSec(message as Record<string, unknown>);
            if (h != null) sessionDurationHintsSec.push(h);
          }
          break;
        }
      }
    }
  } catch {
    return {
      workoutSteps: [],
      workout: null,
      sessionDurationHintsSec: [],
      recordCount: 0,
      fileIds: [],
      declaresWorkoutFileType: false,
    };
  }

  const wHint = extractSessionDurationHintSec(lastWorkout);
  if (wHint != null) sessionDurationHintsSec.push(wHint);

  return {
    workoutSteps,
    workout: lastWorkout,
    sessionDurationHintsSec,
    recordCount,
    fileIds: file_ids,
    declaresWorkoutFileType: fileIdsDeclareWorkout(file_ids),
  };
}
