/**
 * Contratto serializzato in `notes` come V1 (`BUILDER_SESSION_JSON::` + URI-encoded JSON)
 * così calendario / session reader possono riallinearsi.
 */

import type { TechnicalModuleFocus } from "@/lib/training/engine/types";

export const BUILDER_SESSION_JSON_TAG = "BUILDER_SESSION_JSON::";

export type Pro2SessionSummary = {
  durationSec: number;
  tss: number;
  kcal: number;
  kj: number;
  avgPowerW: number;
};

export type Pro2RenderProfile = {
  intensityUnit: "watt" | "hr";
  ftpW: number;
  hrMax: number;
  lengthMode: "time" | "distance";
  speedRefKmh: number;
};

export type Pro2BlockChart = {
  minutes: number;
  seconds: number;
  intensity: string;
  startIntensity: string;
  endIntensity: string;
  intensity2: string;
  intensity3: string;
  repeats: number;
  workSeconds: number;
  recoverSeconds: number;
  step1Seconds: number;
  step2Seconds: number;
  step3Seconds: number;
  pyramidSteps: number;
  pyramidStepSeconds: number;
  pyramidStartTarget: number;
  pyramidEndTarget: number;
  distanceKm: number;
  gradePercent: number;
  elevationMeters: number;
  cadence: string;
  frequencyHint: string;
  loadFactor: number;
};

export type Pro2BuilderBlockContract = {
  id: string;
  label: string;
  kind: string;
  durationMinutes: number;
  intensityCue?: string;
  target?: string;
  notes?: string;
  /** Opzionale: bridge motore / Virya verso chart (allineato V1). */
  mediaUrl?: string;
  chart?: Pro2BlockChart;
  /** Prescrizione gym manuale (catalogo V1 + serie/carico/esecuzione). */
  gymRx?: {
    catalogExerciseId?: string;
    exerciseName?: string;
    sets?: number;
    reps?: string;
    weightKg?: number | null;
    executionStyle?: string;
    /** Percentuale stimata 1RM (prescrizione coach). */
    pct1Rm?: number | null;
    /** Accento contrazione (letteratura). */
    contractionEmphasis?: string;
    /** Etichetta superserie / gruppo (es. "A", "SS1"). */
    chainLabel?: string;
    /** Dettaglio da completare in seduta (scheda rapida). */
    quickIncomplete?: boolean;
  };
  /** Prescrizione macro C: drill / schema da playbook tecnico-tattico. */
  technicalRx?: {
    playbookItemId?: string;
    entryType?: "drill" | "scheme";
    periodsLabel?: string;
    spaceLabel?: string;
    coachingCue?: string;
    /** Chiave futura asset immagine esecuzione (PNG/WEBP); oggi schema SVG V1 in UI. */
    visualAssetKey?: string;
    visualSchemaKind?: "v1_svg" | "raster_pending";
    sportKeyForSchema?: string;
  };
  /** Prescrizione macro D: pratica mind-body da playbook lifestyle (yoga, pilates, respiro…). */
  lifestyleRx?: {
    playbookItemId?: string;
    practiceCategory?: string;
    rounds?: number;
    holdOrReps?: string;
    restSec?: number;
    rpe?: number | null;
    executionStyle?: string;
    breathPattern?: string;
    chainLabel?: string;
    /** URL raster/Spline custom; assente = client usa placeholder V1 da categoria. */
    mediaUrl?: string;
  };
};

export type Pro2BuilderSessionContract = {
  version: 1;
  source: "builder" | "virya";
  family: "aerobic" | "strength" | "technical" | "lifestyle";
  discipline: string;
  sessionName: string;
  adaptationTarget?: string;
  phase?: string;
  /** Durata seduta scelta dal coach (calendario); indipendente dalla somma dei segmenti grafico. */
  plannedSessionDurationMinutes?: number;
  summary: Pro2SessionSummary;
  renderProfile?: Pro2RenderProfile;
  blocks?: Pro2BuilderBlockContract[];
  /** Allineato al pannello generativo Macro C (fase · contesto · qualità). */
  technicalModuleFocus?: TechnicalModuleFocus;
};

export function serializePro2BuilderSessionContract(contract: Pro2BuilderSessionContract): string {
  return `${BUILDER_SESSION_JSON_TAG}${encodeURIComponent(JSON.stringify(contract))}`;
}
