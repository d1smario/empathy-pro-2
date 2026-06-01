/**
 * Espansione repeat Garmin/TrainingPeaks su workout_step FIT.
 *
 * FIT profile: `repeat_until_steps_cmplt` + `duration_step` (message_index di loop)
 * + `repeat_steps` (# ripetizioni). TrainingPeaks esporta tipicamente:
 *   warm → work → recovery → repeat marker → cool
 * Il marker repeat viene DOPO gli step da ripetere e punta indietro con duration_step.
 */
import { normalizeFitWktDurationType } from "./fit-step-duration-decode";

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pickStepNumber(step: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const k of keys) {
    const n = asNumber(step[k]);
    if (n != null && Number.isFinite(n)) return n;
  }
  return null;
}

function pickMessageIndex(step: Record<string, unknown>, arrayIndex: number): number {
  const n = pickStepNumber(step, ["message_index", "messageIndex", "index"]);
  return n != null ? Math.round(n) : arrayIndex;
}

/** # ripetizioni dal repeat step (Garmin SDK: repeat_steps). */
export function pickFitRepeatCount(step: Record<string, unknown>): number {
  const n = pickStepNumber(step, [
    "repeat_steps",
    "repeatSteps",
    "repeat_count",
    "repeatCount",
    "num_repetitions",
    "repetitions",
  ]);
  if (n == null || !Number.isFinite(n) || n < 1) return 1;
  return Math.min(400, Math.max(1, Math.round(n)));
}

/** message_index / indice array del primo step del loop. */
export function resolveFitRepeatLoopStartIndex(
  repeatStep: Record<string, unknown>,
  repeatArrayIndex: number,
  steps: Record<string, unknown>[],
): number {
  const durationStep = pickStepNumber(repeatStep, ["duration_step", "durationStep"]);
  if (durationStep != null && Number.isFinite(durationStep)) {
    const asMsgIdx = Math.round(durationStep);
    for (let j = 0; j < steps.length; j += 1) {
      if (pickMessageIndex(steps[j]!, j) === asMsgIdx) return j;
    }
    /** Alcuni export usano duration_step come indice array diretto. */
    if (asMsgIdx >= 0 && asMsgIdx < steps.length && asMsgIdx !== repeatArrayIndex) return asMsgIdx;
  }
  /** Fallback TP: corpo = step immediatamente prima del marker (solo work, 1 step). */
  if (repeatArrayIndex > 0) return repeatArrayIndex - 1;
  return -1;
}

function isRepeatMarkerStep(step: Record<string, unknown>): boolean {
  return normalizeFitWktDurationType(step) === "repeat_until_steps_cmplt";
}

function cloneStep(step: Record<string, unknown>): Record<string, unknown> {
  return { ...step };
}

function repeatBodySlice(
  steps: Record<string, unknown>[],
  loopStart: number,
  loopEnd: number,
): Record<string, unknown>[] {
  if (loopStart < 0 || loopEnd < loopStart || loopEnd >= steps.length) return [];
  return steps.slice(loopStart, loopEnd + 1).map(cloneStep);
}

function appendRepeatedBody(out: Record<string, unknown>[], body: Record<string, unknown>[], repeatCount: number): void {
  if (!body.length || repeatCount < 1) return;
  for (let r = 0; r < repeatCount; r += 1) {
    out.push(...body.map(cloneStep));
  }
}

/**
 * Materializza repeat FIT in lista lineare di step (work+recupero × N).
 * Gestisce marker repeat DOPO il corpo (Garmin/TP) e marker PRIMA (lookahead).
 */
export function flattenFitWorkoutStepsWithRepeats(steps: Record<string, unknown>[]): Record<string, unknown>[] {
  if (!steps.length) return [];

  const out: Record<string, unknown>[] = [];
  let i = 0;

  while (i < steps.length) {
    const step = steps[i]!;
    if (!isRepeatMarkerStep(step)) {
      out.push(cloneStep(step));
      i += 1;
      continue;
    }

    const repeatCount = pickFitRepeatCount(step);
    const loopStart = resolveFitRepeatLoopStartIndex(step, i, steps);

    if (loopStart > i) {
      /** Repeat marker PRIMA del corpo: corpo segue fino al prossimo repeat o fine blocco. */
      let loopEnd = loopStart;
      const hintedSteps = pickStepNumber(step, ["duration_value", "durationValue"]);
      if (hintedSteps != null && hintedSteps >= 1 && hintedSteps <= 20) {
        loopEnd = Math.min(steps.length - 1, loopStart + Math.round(hintedSteps) - 1);
      } else {
        while (loopEnd + 1 < steps.length && !isRepeatMarkerStep(steps[loopEnd + 1]!)) {
          loopEnd += 1;
          if (loopEnd - loopStart >= 8) break;
        }
      }
      const body = repeatBodySlice(steps, loopStart, loopEnd);
      appendRepeatedBody(out, body, repeatCount);
      i = loopEnd + 1;
      continue;
    }

    /** Repeat marker DOPO il corpo: corpo = loopStart..i-1 (già emesso in out). */
    const loopEnd = i - 1;
    const bodyLen = loopEnd - loopStart + 1;
    if (loopStart >= 0 && bodyLen > 0) {
      let body: Record<string, unknown>[];
      if (out.length >= bodyLen) {
        body = out.splice(out.length - bodyLen, bodyLen);
      } else {
        body = repeatBodySlice(steps, loopStart, loopEnd);
      }
      appendRepeatedBody(out, body, repeatCount);
    }
    i += 1;
  }

  return out;
}

/**
 * Se il repeat copre esattamente work+recovery (2 step), restituisce shape interval2
 * invece di espandere in N×2 step steady (migliore per Builder / grafico TP).
 */
export type FitRepeatInterval2Shape = {
  work: Record<string, unknown>;
  recovery: Record<string, unknown>;
  repeats: number;
};

export type FitWorkoutStepForImport = Record<string, unknown> & {
  _fitInterval2?: FitRepeatInterval2Shape;
};

export function tryFitRepeatAsInterval2(
  repeatStep: Record<string, unknown>,
  repeatArrayIndex: number,
  steps: Record<string, unknown>[],
): FitRepeatInterval2Shape | null {
  if (!isRepeatMarkerStep(repeatStep)) return null;
  const repeats = pickFitRepeatCount(repeatStep);
  if (repeats < 2) return null;

  const loopStart = resolveFitRepeatLoopStartIndex(repeatStep, repeatArrayIndex, steps);
  let loopEnd: number;
  if (loopStart > repeatArrayIndex) {
    loopEnd = loopStart + 1;
    if (loopEnd >= steps.length || isRepeatMarkerStep(steps[loopEnd]!)) loopEnd = loopStart;
  } else {
    loopEnd = repeatArrayIndex - 1;
  }

  const body = repeatBodySlice(steps, loopStart, loopEnd);
  if (body.length !== 2) return null;
  return { work: body[0]!, recovery: body[1]!, repeats };
}

/** Espansione completa con preferenza interval2 per coppie work/recovery. */
export function expandFitWorkoutStepsForImport(steps: Record<string, unknown>[]): FitWorkoutStepForImport[] {
  if (!steps.length) return [];

  const out: FitWorkoutStepForImport[] = [];
  let i = 0;

  while (i < steps.length) {
    const step = steps[i]!;
    if (!isRepeatMarkerStep(step)) {
      out.push(cloneStep(step));
      i += 1;
      continue;
    }

    const interval2 = tryFitRepeatAsInterval2(step, i, steps);
    if (interval2) {
      const loopStart = resolveFitRepeatLoopStartIndex(step, i, steps);
      const loopEnd = loopStart > i ? loopStart + 1 : i - 1;
      const bodyLen = loopEnd - loopStart + 1;
      if (loopStart <= i && bodyLen > 0 && out.length >= bodyLen) {
        out.splice(out.length - bodyLen, bodyLen);
      } else if (loopStart > i) {
        i = loopEnd + 1;
        out.push({ _fitInterval2: interval2 });
        continue;
      }
      out.push({ _fitInterval2: interval2 });
      i += 1;
      continue;
    }

    const repeatCount = pickFitRepeatCount(step);
    const loopStart = resolveFitRepeatLoopStartIndex(step, i, steps);

    if (loopStart > i) {
      let loopEnd = loopStart;
      const hintedSteps = pickStepNumber(step, ["duration_value", "durationValue"]);
      if (hintedSteps != null && hintedSteps >= 1 && hintedSteps <= 20) {
        loopEnd = Math.min(steps.length - 1, loopStart + Math.round(hintedSteps) - 1);
      } else {
        while (loopEnd + 1 < steps.length && !isRepeatMarkerStep(steps[loopEnd + 1]!)) {
          loopEnd += 1;
          if (loopEnd - loopStart >= 8) break;
        }
      }
      appendRepeatedBody(out, repeatBodySlice(steps, loopStart, loopEnd), repeatCount);
      i = loopEnd + 1;
      continue;
    }

    const loopEnd = i - 1;
    const bodyLen = loopEnd - loopStart + 1;
    if (loopStart >= 0 && bodyLen > 0) {
      let body: Record<string, unknown>[];
      if (out.length >= bodyLen) {
        body = out.splice(out.length - bodyLen, bodyLen);
      } else {
        body = repeatBodySlice(steps, loopStart, loopEnd);
      }
      appendRepeatedBody(out, body, repeatCount);
    }
    i += 1;
  }

  return out;
}
