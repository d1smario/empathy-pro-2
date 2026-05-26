import {
  defaultManualPlanBlock,
  type ManualPlanBlock,
  type PlanBlockKind,
} from "@/lib/training/builder/manual-plan-block";
import { defaultPro2GymManualRow, type Pro2GymManualRow } from "@/lib/training/builder/pro2-gym-manual-plan";
import {
  defaultPro2LifestyleManualRow,
  type Pro2LifestyleManualRow,
} from "@/lib/training/builder/pro2-lifestyle-manual-plan";
import {
  defaultPro2TechnicalManualRow,
  type Pro2TechnicalManualRow,
} from "@/lib/training/builder/pro2-technical-manual-plan";
import { zoneFromIntensityCue, type Pro2IntensityLabel } from "@/lib/training/builder/pro2-intensity";
import type { Pro2BuilderBlockContract, Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import { effectiveDurationMinutesFromPro2Contract } from "@/lib/training/builder/pro2-session-notes";
import { normalizeSessionDurationMinutes } from "@/lib/training/builder/session-duration-choices";
import { SPORT_MACRO_SECTORS, type SportMacroId } from "@/lib/training/builder/sport-macro-palette";
import type { LifestylePracticeCategory } from "@/lib/training/builder/lifestyle-playbook-catalog";
import type { Pro2GymContractionPreset } from "@/lib/training/builder/pro2-gym-library-filters";

export type BuilderStateFromLibraryContract = {
  macroId: SportMacroId;
  sport: string;
  manualSessionName: string;
  manualSessionDurationMinutes: number;
  intensityUnit: "watt" | "hr";
  ftpW: number;
  hrMax: number;
  lengthMode: "time" | "distance";
  speedRefKmh: number;
  manualPlanBlocks: ManualPlanBlock[];
  gymManualRows: Pro2GymManualRow[];
  technicalManualRows: Pro2TechnicalManualRow[];
  lifestyleManualRows: Pro2LifestyleManualRow[];
};

function parseZone(raw: string | undefined, fallback: Pro2IntensityLabel = "Z2"): Pro2IntensityLabel {
  const z = zoneFromIntensityCue(String(raw ?? "").trim(), fallback);
  return z as Pro2IntensityLabel;
}

function planKindFromContract(kind: string | undefined): PlanBlockKind {
  const k = (kind ?? "steady").toLowerCase();
  if (k === "interval2" || k === "interval3" || k === "ramp" || k === "pyramid" || k === "steady") return k;
  return "steady";
}

export function resolveSportForLibraryContract(contract: Pro2BuilderSessionContract): string {
  const disc = contract.discipline.trim().toLowerCase();
  const sector = SPORT_MACRO_SECTORS.find((s) => s.id === contract.family);
  if (!sector) return "cycling";
  const match = sector.sports.find(
    (s) => s.label.toLowerCase() === disc || s.sport.toLowerCase() === disc || disc.includes(s.sport.toLowerCase()),
  );
  return match?.sport ?? sector.sports[0]?.sport ?? "cycling";
}

function manualPlanBlockFromContractBlock(block: Pro2BuilderBlockContract): ManualPlanBlock {
  const ch = block.chart;
  const kind = planKindFromContract(block.kind);
  const base = defaultManualPlanBlock(kind, block.label || "Blocco");
  if (!ch) {
    return {
      ...base,
      id: block.id || base.id,
      label: block.label || base.label,
      minutes: Math.max(0, Math.floor(Number(block.durationMinutes) || base.minutes)),
      target: block.target?.trim() ?? "",
      notes: block.notes?.trim() ?? "",
    };
  }
  return {
    ...base,
    id: block.id || base.id,
    label: block.label || base.label,
    kind,
    minutes: Math.max(0, ch.minutes ?? Math.floor(Number(block.durationMinutes) || 0)),
    seconds: Math.max(0, Math.min(59, ch.seconds ?? 0)),
    intensity: parseZone(ch.intensity, base.intensity),
    startIntensity: parseZone(ch.startIntensity || ch.intensity, base.startIntensity),
    endIntensity: parseZone(ch.endIntensity || ch.intensity, base.endIntensity),
    intensity2: parseZone(ch.intensity2, base.intensity2),
    intensity3: parseZone(ch.intensity3, base.intensity3),
    repeats: Math.max(1, ch.repeats ?? base.repeats),
    workSeconds: Math.max(0, ch.workSeconds ?? base.workSeconds),
    recoverSeconds: Math.max(0, ch.recoverSeconds ?? base.recoverSeconds),
    step1Seconds: Math.max(0, ch.step1Seconds ?? base.step1Seconds),
    step2Seconds: Math.max(0, ch.step2Seconds ?? base.step2Seconds),
    step3Seconds: Math.max(0, ch.step3Seconds ?? base.step3Seconds),
    pyramidSteps: Math.max(1, ch.pyramidSteps ?? base.pyramidSteps),
    pyramidStepSeconds: Math.max(0, ch.pyramidStepSeconds ?? base.pyramidStepSeconds),
    pyramidStartTarget: ch.pyramidStartTarget ?? base.pyramidStartTarget,
    pyramidEndTarget: ch.pyramidEndTarget ?? base.pyramidEndTarget,
    distanceKm: ch.distanceKm ?? base.distanceKm,
    gradePercent: ch.gradePercent ?? base.gradePercent,
    elevationMeters: ch.elevationMeters ?? base.elevationMeters,
    target: block.target?.trim() ?? "",
    notes: block.notes?.trim() ?? "",
    loadFactor: ch.loadFactor > 0 ? ch.loadFactor : base.loadFactor,
  };
}

function gymRowFromContractBlock(block: Pro2BuilderBlockContract): Pro2GymManualRow {
  const rx = block.gymRx;
  return defaultPro2GymManualRow({
    id: block.id,
    exerciseId: rx?.catalogExerciseId?.trim() ?? "",
    name: rx?.exerciseName?.trim() || block.label || "Esercizio",
    sets: rx?.sets ?? 3,
    reps: rx?.reps?.trim() ?? "8",
    loadKg: rx?.weightKg ?? null,
    restSec: 90,
    executionStyle: rx?.executionStyle?.trim() ?? "",
    pct1Rm: rx?.pct1Rm ?? null,
    contractionEmphasis: (rx?.contractionEmphasis?.trim() ?? "") as Pro2GymContractionPreset,
    chainLabel: rx?.chainLabel?.trim() ?? "",
    quickIncomplete: rx?.quickIncomplete ?? false,
    notes: block.notes?.trim() ?? "",
  });
}

function technicalRowFromContractBlock(block: Pro2BuilderBlockContract, sportKey: string): Pro2TechnicalManualRow {
  const rx = block.technicalRx;
  return defaultPro2TechnicalManualRow({
    id: block.id,
    entryType: rx?.entryType ?? "drill",
    playbookItemId: rx?.playbookItemId?.trim() ?? "",
    sportKeyForSchema: rx?.sportKeyForSchema?.trim() || sportKey,
    visualAssetKey: rx?.visualAssetKey?.trim() ?? block.id,
    visualSchemaKind: rx?.visualSchemaKind ?? "v1_svg",
    name: block.label || "Drill",
    durationMinutes: Math.max(5, Math.round(Number(block.durationMinutes) || 12)),
    periodsLabel: rx?.periodsLabel?.trim() ?? "",
    spaceLabel: rx?.spaceLabel?.trim() ?? "",
    coachingCue: rx?.coachingCue?.trim() ?? block.intensityCue?.trim() ?? "",
    notes: block.notes?.trim() ?? "",
  });
}

function lifestyleRowFromContractBlock(block: Pro2BuilderBlockContract): Pro2LifestyleManualRow {
  const rx = block.lifestyleRx;
  const cat = (rx?.practiceCategory?.trim() ?? "mobility") as LifestylePracticeCategory;
  return defaultPro2LifestyleManualRow({
    id: block.id,
    playbookItemId: rx?.playbookItemId?.trim() ?? "",
    practiceCategory: cat,
    name: block.label || "Pratica",
    rounds: rx?.rounds ?? 2,
    holdOrReps: rx?.holdOrReps?.trim() ?? "",
    restSec: rx?.restSec ?? 45,
    rpe: rx?.rpe ?? null,
    executionStyle: rx?.executionStyle?.trim() ?? "",
    breathPattern: rx?.breathPattern?.trim() ?? "",
    chainLabel: rx?.chainLabel?.trim() ?? "",
    notes: block.notes?.trim() ?? "",
    mediaUrl: rx?.mediaUrl?.trim() || block.mediaUrl?.trim() || undefined,
  });
}

/** Carica un contratto libreria nello stato editabile del Builder manuale. */
export function hydrateBuilderStateFromLibraryContract(
  contract: Pro2BuilderSessionContract,
): BuilderStateFromLibraryContract {
  const macroId = contract.family;
  const sport = resolveSportForLibraryContract(contract);
  const rp = contract.renderProfile;
  const blocks = contract.blocks ?? [];
  const durationFallback = effectiveDurationMinutesFromPro2Contract(contract, 60);

  const manualPlanBlocks =
    macroId === "aerobic"
      ? blocks.length > 0
        ? blocks.map(manualPlanBlockFromContractBlock)
        : [defaultManualPlanBlock("steady", contract.sessionName || "Seduta")]
      : [];

  const gymManualRows = macroId === "strength" ? blocks.map(gymRowFromContractBlock) : [];
  const technicalManualRows =
    macroId === "technical" ? blocks.map((b) => technicalRowFromContractBlock(b, sport)) : [];
  const lifestyleManualRows = macroId === "lifestyle" ? blocks.map(lifestyleRowFromContractBlock) : [];

  return {
    macroId,
    sport,
    manualSessionName: contract.sessionName?.trim() || "Seduta libreria",
    manualSessionDurationMinutes: normalizeSessionDurationMinutes(
      contract.plannedSessionDurationMinutes ?? durationFallback,
    ),
    intensityUnit: rp?.intensityUnit === "hr" ? "hr" : "watt",
    ftpW: Math.max(50, Math.round(rp?.ftpW ?? 250)),
    hrMax: Math.max(120, Math.round(rp?.hrMax ?? 185)),
    lengthMode: rp?.lengthMode === "distance" ? "distance" : "time",
    speedRefKmh: Math.max(5, rp?.speedRefKmh ?? 32),
    manualPlanBlocks,
    gymManualRows,
    technicalManualRows,
    lifestyleManualRows,
  };
}
