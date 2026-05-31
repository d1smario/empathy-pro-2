import type {
  BioenergeticConditioningContextV1,
  BioenergeticContextCoverageV1,
  BioenergeticFluidIntakeWindowV1,
  BioenergeticLabAnchorV1,
  BioenergeticNutritionWindowV1,
  BioenergeticSleepAutonomicWindowV1,
  BioenergeticTrainingStimulusWindowV1,
} from "@empathy/contracts";
import { analyzeBioenergeticBiaLiteratureV1 } from "@empathy/domain-bioenergetics";
import type { BioenergeticTimelineEvent } from "@/api/bioenergetics/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { readFastingGlucoseMmolL } from "@/lib/health/lab-marker-resolver";
import { deviceExportsHaveHrSignal, extractBestBioimpedanceSnapshot } from "@/lib/bioenergetics/bioenergetic-device-signals-for-context";
import { resolveMealTimelineIsoTs } from "@/lib/bioenergetics/bioenergetic-day-timeline";
import { num } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";
import { extractSleepRecoverySignal } from "@/lib/reality/sleep-recovery-signals";

const WATER_LABEL_RE = /\b(acqua|water|h2o|hydration|idratazione)\b/i;

function fluidIntakeWindowsFromDiary(slice: BioenergeticDayMemorySlice): BioenergeticFluidIntakeWindowV1[] {
  const out: BioenergeticFluidIntakeWindowV1[] = [];
  const dateKey = slice.date.slice(0, 10);
  slice.diaryRows.forEach((row, i) => {
    const label = typeof row.food_label === "string" ? row.food_label : "";
    if (!WATER_LABEL_RE.test(label)) return;
    const qtyG = num(row.quantity_g);
    if (qtyG == null || qtyG < 20) return;
    const startTs = resolveMealTimelineIsoTs(dateKey, row as Record<string, unknown>, i);
    const sodiumMg = num(row.sodium_mg);
    out.push({
      windowId: `fluid-diary-${String(row.id ?? out.length)}`,
      startTs,
      volumeMl: Math.round(qtyG),
      sodiumMg: sodiumMg ?? undefined,
    });
  });
  return out;
}

function trainingFromTimeline(timeline: BioenergeticTimelineEvent[]): BioenergeticTrainingStimulusWindowV1[] {
  const out: BioenergeticTrainingStimulusWindowV1[] = [];
  for (const ev of timeline) {
    if (ev.type !== "planned_session" && ev.type !== "executed_session") continue;
    const duration = num(ev.payload?.durationMinutes as unknown);
    const tssExec = num(ev.payload?.tss as unknown);
    const tssPlan = num(ev.payload?.tssTarget as unknown);
    out.push({
      windowId: ev.id,
      startTs: ev.ts,
      durationMinutes: duration ?? undefined,
      tss: ev.type === "executed_session" ? tssExec ?? undefined : tssPlan ?? undefined,
      plannedVsExecuted: ev.type === "executed_session" ? "executed_only" : "planned_only",
      intensityClass: "unknown",
      fuelingDeclared: undefined,
    });
  }
  return out;
}

function nutritionFromTimeline(timeline: BioenergeticTimelineEvent[]): BioenergeticNutritionWindowV1[] {
  const out: BioenergeticNutritionWindowV1[] = [];
  for (const ev of timeline) {
    if (ev.type !== "meal") continue;
    const carbs = num(ev.payload?.carbsG as unknown);
    const il = num(ev.payload?.insulinLoad as unknown);
    out.push({
      windowId: ev.id,
      startTs: ev.ts,
      carbsG: carbs ?? undefined,
      insulinLoad: il ?? undefined,
      proteinG: num(ev.payload?.proteinG as unknown) ?? undefined,
      fatG: num(ev.payload?.fatG as unknown) ?? undefined,
      kcal: num(ev.payload?.kcal as unknown) ?? undefined,
      mealQuality: carbs != null && carbs > 0 ? "complete_log" : "time_only",
    });
  }
  return out;
}

function sleepFromDeviceExports(slice: BioenergeticDayMemorySlice): BioenergeticSleepAutonomicWindowV1[] {
  const out: BioenergeticSleepAutonomicWindowV1[] = [];
  for (const row of slice.deviceExportRows) {
    const id = typeof row.id === "string" ? row.id : String(row.id ?? "");
    const createdAt = typeof row.created_at === "string" ? row.created_at : `${slice.date}T12:00:00`;
    const payload = row.payload;
    if (!payload || typeof payload !== "object") continue;
    const sig = extractSleepRecoverySignal(payload as Record<string, unknown>);
    if (
      sig.sleepDurationHours == null &&
      sig.hrvMs == null &&
      sig.restingHrBpm == null &&
      sig.sleepScore == null
    ) {
      continue;
    }
    out.push({
      windowId: `sleep-${id || createdAt}`,
      startTs: createdAt,
      endTs: undefined,
      sleepHours: sig.sleepDurationHours ?? undefined,
      sleepEfficiency01: sig.sleepScore != null ? clamp01(sig.sleepScore / 100) : undefined,
      hrvRmssdMs: sig.hrvMs ?? undefined,
    });
  }
  return out;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function labAnchorsFromBiomarkers(slice: BioenergeticDayMemorySlice): BioenergeticLabAnchorV1[] {
  const out: BioenergeticLabAnchorV1[] = [];
  for (const row of slice.biomarkerRows) {
    const values = row.values as Record<string, unknown> | null | undefined;
    if (!values || typeof values !== "object") continue;
    const ts =
      typeof row.sample_date === "string" && row.sample_date.trim()
        ? `${row.sample_date}T07:00:00`
        : typeof row.created_at === "string"
          ? row.created_at
          : `${slice.date}T07:00:00`;
    const g = readFastingGlucoseMmolL(values);
    if (g != null) {
      out.push({
        ts,
        analyteId: "glucose_mmol_anchor",
        value: g,
        unit: "mmol/L",
        provenance: "measured",
        fasting: true,
      });
      break;
    }
  }
  return out;
}

export function computeBioenergeticCoverage(input: {
  training: BioenergeticTrainingStimulusWindowV1[];
  nutrition: BioenergeticNutritionWindowV1[];
  sleepAutonomic: BioenergeticSleepAutonomicWindowV1[];
  labAnchors: BioenergeticLabAnchorV1[];
  hasDeviceHrSignal: boolean;
  hasBia: boolean;
  /** Se presente, affina il punteggio asse BIA (modello letteratura v1). */
  biaModelConfidence01?: number;
  fluidIntakeWindows: number;
}): BioenergeticContextCoverageV1 {
  const missing: string[] = [];
  const t = input.training.length ? Math.min(1, 0.4 + input.training.length * 0.2) : 0.2;
  if (t < 0.45) missing.push("training");
  const n = input.nutrition.length ? Math.min(1, 0.35 + input.nutrition.length * 0.2) : 0.15;
  if (n < 0.45) missing.push("nutrition");
  const s = input.sleepAutonomic.some((x) => x.sleepHours != null || x.hrvRmssdMs != null) ? 0.85 : 0.25;
  if (s < 0.5) missing.push("sleep");
  const l = input.labAnchors.length ? 0.9 : 0.25;
  if (l < 0.5) missing.push("lab");
  const hr = input.hasDeviceHrSignal ? 0.75 : 0.2;
  if (hr < 0.45) missing.push("hr_stream");
  const bia = input.hasBia
    ? input.biaModelConfidence01 != null
      ? clamp(0.3 + 0.58 * input.biaModelConfidence01, 0.28, 0.9)
      : 0.62
    : 0.18;
  if (!input.hasBia) missing.push("bia");
  const fiW = input.fluidIntakeWindows;
  const fi = fiW > 0 ? Math.min(0.72, 0.35 + fiW * 0.12) : 0.16;
  if (fiW === 0) missing.push("fluid_intake");
  missing.push("environment");
  return {
    training: t,
    nutrition: n,
    sleep: s,
    lab: l,
    hr_stream: hr,
    bia,
    fluid_intake: fi,
    environment: 0.14,
    missingAxes: missing,
  };
}

export function buildBioenergeticConditioningContextFromDay(input: {
  athleteId: string;
  date: string;
  timeZone?: string;
  timeline: BioenergeticTimelineEvent[];
  slice: BioenergeticDayMemorySlice;
}): BioenergeticConditioningContextV1 {
  const { athleteId, date, timeline, slice } = input;
  const timeZone = input.timeZone ?? "UTC";
  const training = trainingFromTimeline(timeline);
  const nutrition = nutritionFromTimeline(timeline);
  const sleepAutonomic = sleepFromDeviceExports(slice);
  const labAnchors = labAnchorsFromBiomarkers(slice);
  const hasDeviceHrSignal = deviceExportsHaveHrSignal(slice);
  const bodyComposition = extractBestBioimpedanceSnapshot(slice);
  const biaLiteratureSummary = bodyComposition
    ? analyzeBioenergeticBiaLiteratureV1({ snapshot: bodyComposition, phenotype: undefined })
    : undefined;
  const fluidIntake = fluidIntakeWindowsFromDiary(slice);
  const coverage = computeBioenergeticCoverage({
    training,
    nutrition,
    sleepAutonomic,
    labAnchors,
    hasDeviceHrSignal,
    hasBia: bodyComposition != null,
    biaModelConfidence01: biaLiteratureSummary?.confidence01,
    fluidIntakeWindows: fluidIntake.length,
  });

  return {
    athleteId,
    localDate: date.slice(0, 10),
    timeZone,
    training,
    nutrition,
    sleepAutonomic: sleepAutonomic.length ? sleepAutonomic : undefined,
    labAnchors,
    bodyComposition,
    biaLiteratureSummary,
    fluidIntake: fluidIntake.length ? fluidIntake : undefined,
    coverage,
  };
}
