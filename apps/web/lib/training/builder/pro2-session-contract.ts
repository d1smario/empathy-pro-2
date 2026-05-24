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
  /**
   * Interpretazione multilivello deterministica (domande coach, facilitazioni, settori attivi).
   * Serializzata con il contratto in notes / libreria coach.
   */
  sessionInterpretation?: Pro2SessionInterpretation;
};

export type Pro2SessionInterpretationSector = {
  category: string;
  shortLabelIt: string;
  valueLineIt: string;
  detailHintIt: string;
  facetId: string;
  pathwayPills?: Array<{ id: string; text: string; direction: "forward" | "reverse" }>;
};

export type Pro2SessionInterpretation = {
  modelVersion: 1;
  layer: "deterministic_session_facet_template";
  coachPrompts: string[];
  facilitationHints: string[];
  sectors: Pro2SessionInterpretationSector[];
  /** ISO timestamp generazione snapshot (persist). */
  generatedAt?: string;
};

export function serializePro2BuilderSessionContract(contract: Pro2BuilderSessionContract): string {
  const { preparePro2BuilderSessionContractForPersist } =
    require("@/lib/training/builder/pro2-session-interpretation") as typeof import("@/lib/training/builder/pro2-session-interpretation");
  const prepared = preparePro2BuilderSessionContractForPersist(contract);
  return `${BUILDER_SESSION_JSON_TAG}${encodeURIComponent(JSON.stringify(prepared))}`;
}
