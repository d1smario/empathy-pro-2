import "server-only";

/**
 * fit-file-parser in mode `list` sovrascrive `fitObj.workout_step` ad ogni messaggio (vedi `dist/fit-parser.js` default branch).
 * Per import programmato FIT serve l’elenco completo degli step: replichiamo il loop binario usando `readRecord` esportato.
 */
// @ts-expect-error sotto-percorso senza types nel package; runtime ESM risolve.
import { calculateCRC, getArrayBuffer, readRecord } from "fit-file-parser/dist/binary.js";

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
  recordCount: number;
  fileIds: Record<string, unknown>[];
  /** True se almeno un `file_id` dichiara type workout (Garmin / TP export). */
  declaresWorkoutFileType: boolean;
};

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
  const file_ids: Record<string, unknown>[] = [];
  let recordCount = 0;

  try {
    const blob = new Uint8Array(getArrayBuffer(buffer));
    const bounds = fitBounds(blob);
    if (!bounds) {
      return {
        workoutSteps: [],
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
        case "workout_step":
          if (message && typeof message === "object") {
            workoutSteps.push(message as Record<string, unknown>);
          }
          break;
        default:
          break;
      }
    }
  } catch {
    return {
      workoutSteps: [],
      recordCount: 0,
      fileIds: [],
      declaresWorkoutFileType: false,
    };
  }

  return {
    workoutSteps,
    recordCount,
    fileIds: file_ids,
    declaresWorkoutFileType: fileIdsDeclareWorkout(file_ids),
  };
}
