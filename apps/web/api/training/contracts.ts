import type { PlannedWorkout } from "@empathy/domain-training";
import type {
  AdaptationGuidance,
  AthleteMemory,
  KnowledgeModulationSnapshot,
  PhysiologyState,
  RealityImportJob,
  ResearchPlan,
  SessionKnowledgePacket,
} from "@/lib/empathy/schemas";
import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type { AdaptationTarget, SessionGoalRequest, TrainingDomain } from "@/lib/training/engine";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";
import type { CanonicalTwinState } from "@/lib/twin/athlete-state-resolver";
import type { DailyLoadPoint } from "@/lib/training/analytics/load-series";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";

export type TrainingAdaptationLoopViewModel = {
  windowDays: number;
  expectedLoad7d: number;
  realLoad7d: number;
  internalLoad7d: number;
  executionCompliancePct: number;
  executionDeltaTss: number;
  divergenceScore: number;
  interventionScore: number;
  readinessScore: number;
  adaptationScore: number;
  status: "aligned" | "watch" | "regenerate";
  nextAction: "keep_course" | "retune_next_sessions" | "regenerate_microcycle";
  triggers: string[];
  guidance: string;
};

export type TrainingBioenergeticModulationViewModel = {
  loadScale: number;
  loadScalePct: number;
  state: "supported" | "watch" | "protective";
  mitochondrialReadinessScore: number;
  signalCoveragePct: number;
  inputUncertaintyPct: number;
  missingSignals: string[];
  recommendedInputs: string[];
  cellularHydrationScore: number | null;
  autonomicRecoveryScore: number | null;
  inflammatoryStressScore: number | null;
  fuelAvailabilityScore: number | null;
  phaseAngleNormalized: number | null;
  signalCoverage: string[];
  headline: string;
  guidance: string;
  evidenceTier: "proxy_supported";
};

export type TrainingPlannerContextViewModel = {
  athleteId: string;
  profile: Record<string, unknown> | null;
  physiology: Record<string, unknown> | null;
  physiologyState?: PhysiologyState | null;
  health: Record<string, unknown> | null;
  latestLab: Record<string, unknown> | null;
  twinState?: CanonicalTwinState | null;
  athleteMemory?: AthleteMemory | null;
  recoverySummary?: RecoverySummary | null;
  operationalContext?: TrainingDayOperationalContext | null;
  adaptationLoop?: TrainingAdaptationLoopViewModel | null;
  bioenergeticModulation?: TrainingBioenergeticModulationViewModel | null;
  knowledgeModulation?: KnowledgeModulationSnapshot | null;
  researchPlans?: ResearchPlan[];
  researchTraces?: KnowledgeResearchTraceSummary[];
  flags: Record<string, boolean>;
  strategyHints: string[];
  connectedModules: {
    profile: boolean;
    physiology: boolean;
    health: boolean;
  };
  error?: string | null;
};

export type BuilderSessionGenerationInput = {
  athleteId: string;
  applyOperationalScaling?: boolean;
  request: {
    sport: string;
    domain?: TrainingDomain;
    goalLabel: string;
    adaptationTarget: AdaptationTarget;
    sessionMinutes: number;
    phase: SessionGoalRequest["phase"];
    tssTargetHint?: number;
    intensityHint?: string;
    objectiveDetail?: string;
  };
};

export type BuilderSessionOperationalScalingViewModel = {
  applied: boolean;
  operationalApplied?: boolean;
  bioenergeticApplied?: boolean;
  loadScale: number;
  loadScalePct: number;
  mode: string;
  operationalLoadScale?: number;
  operationalLoadScalePct?: number;
  bioenergeticLoadScale?: number;
  bioenergeticLoadScalePct?: number;
  sessionMinutesRequested: number;
  sessionMinutesEffective: number;
  tssTargetHintRequested: number | null;
  tssTargetHintEffective: number | null;
  headline: string;
  guidance: string;
};

export type BuilderSessionGenerationResponse = {
  athleteId?: string;
  session?: Record<string, unknown>;
  athleteState?: Record<string, unknown>;
  athleteMemory?: AthleteMemory | null;
  blockExercises?: Array<Record<string, unknown>>;
  source?: string;
  operationalContext?: TrainingDayOperationalContext | null;
  recoverySummary?: RecoverySummary | null;
  operationalScaling?: BuilderSessionOperationalScalingViewModel | null;
  adaptationLoop?: TrainingAdaptationLoopViewModel | null;
  bioenergeticModulation?: TrainingBioenergeticModulationViewModel | null;
  knowledgeModulation?: KnowledgeModulationSnapshot | null;
  sessionKnowledge?: SessionKnowledgePacket | null;
  researchPlan?: ResearchPlan | null;
  researchTrace?: KnowledgeResearchTraceSummary | null;
  error?: string;
};

export type TrainingPlannerCalendarRow = {
  athlete_id: string;
  date: string;
  type: string;
  duration_minutes: number;
  tss_target: number;
  kcal_target: number | null;
  notes: string | null;
};

export type TrainingPlannerCalendarReplaceInput = {
  athleteId: string;
  replaceTag?: string;
  rows: TrainingPlannerCalendarRow[];
};

export type TrainingPlannerCalendarReplaceResult = {
  status: "ok";
  athleteMemory?: AthleteMemory | null;
};

export type TrainingPlannedWorkoutViewModel = Record<string, unknown> & {
  builderSession?: Pro2BuilderSessionContract | null;
  canonicalPlannedWorkout?: PlannedWorkout | null;
  plannedDiscipline?: string | null;
  plannedFamily?: string | null;
  plannedSessionName?: string | null;
  plannedAdaptationTarget?: string | null;
};

export type TrainingCalendarViewModel = {
  athleteId: string;
  from: string;
  to: string;
  planned: TrainingPlannedWorkoutViewModel[];
  executed: Array<Record<string, unknown>>;
  twinState?: CanonicalTwinState | null;
  recoverySummary?: RecoverySummary | null;
  adaptationGuidance?: AdaptationGuidance | null;
  operationalContext?: TrainingDayOperationalContext | null;
  adaptationLoop?: TrainingAdaptationLoopViewModel | null;
  bioenergeticModulation?: TrainingBioenergeticModulationViewModel | null;
  nutritionPerformanceIntegration?: NutritionPerformanceIntegrationDials | null;
  athleteMemory?: AthleteMemory | null;
  error?: string | null;
};

export type TrainingTrendPointViewModel = {
  date: string;
  tss: number | null;
  power: number | null;
  hr: number | null;
  cadence: number | null;
  speed: number | null;
  altitude: number | null;
  temperature: number | null;
  coreTemp: number | null;
  lactate: number | null;
  glucose: number | null;
  smo2: number | null;
};

export type TrainingTrendViewModel = {
  athleteId: string;
  from: string;
  to: string;
  trend: TrainingTrendPointViewModel[];
  error?: string | null;
};

export type TrainingImportJobsViewModel = {
  athleteId: string;
  jobs: RealityImportJob[];
  error?: string | null;
};

export type TrainingSessionViewModel = {
  athleteId?: string;
  date?: string;
  planned: TrainingPlannedWorkoutViewModel[];
  executed: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  twinState?: CanonicalTwinState | null;
  recoverySummary?: RecoverySummary | null;
  adaptationGuidance?: AdaptationGuidance | null;
  operationalContext?: TrainingDayOperationalContext | null;
  adaptationLoop?: TrainingAdaptationLoopViewModel | null;
  bioenergeticModulation?: TrainingBioenergeticModulationViewModel | null;
  athleteMemory?: AthleteMemory | null;
  error?: string | null;
};

export type TrainingAnalyticsComparePointViewModel = {
  date: string;
  planned: number;
  executed: number;
  internal: number;
  ctl: number;
  atl: number;
  tsb: number;
  iCtl: number;
  iAtl: number;
  iTsb: number;
  executionVsPlanPct: number;
};

export type TrainingAnalyticsWindowViewModel = {
  last7: { external: number; internal: number; coupling: number };
  last28: { external: number; internal: number; coupling: number };
  couplingDelta: number;
};

export type TrainingAnalyticsPlanWindowViewModel = {
  last7: {
    planned: number;
    executed: number;
    internal: number;
    delta: number;
    compliancePct: number;
    internalVsExecuted: number;
  };
  last28: {
    planned: number;
    executed: number;
    internal: number;
    delta: number;
    compliancePct: number;
    internalVsExecuted: number;
  };
};

export type TrainingAnalyticsViewModel = {
  athleteId?: string;
  from?: string;
  to?: string;
  rows: Array<Record<string, unknown>>;
  plannedRows: Array<Record<string, unknown>>;
  series: DailyLoadPoint[];
  compareSeries: TrainingAnalyticsComparePointViewModel[];
  latest: DailyLoadPoint | null;
  windows: TrainingAnalyticsWindowViewModel | null;
  planWindows: TrainingAnalyticsPlanWindowViewModel | null;
  adaptationLoop: TrainingAdaptationLoopViewModel | null;
  twinState: CanonicalTwinState | null;
  athleteMemory: AthleteMemory | null;
  recoverySummary: RecoverySummary | null;
  operationalContext: TrainingDayOperationalContext | null;
  bioenergeticModulation: TrainingBioenergeticModulationViewModel | null;
  error?: string | null;
};

/** Ambiti di lettura incrociata training → fisiologia / endocrino / neuro / microbiota (interpretazione, non diagnosi). */
export type SessionAnalysisFacetCategory =
  | "bioenergetics"
  | "oxygen_hypoxia"
  | "glycolysis"
  | "muscle_cellular"
  | "neuro_adrenergic"
  | "endocrine_stress"
  | "endocrine_growth"
  | "repair_anabolic"
  | "genetic_regulation"
  | "microbiota_gut";

export type SessionAnalysisFacetSource =
  | "adaptation_target"
  | "session_family"
  | "session_knowledge"
  | "load_proxy"
  | "session_structure";

export type SessionAnalysisFacetViewModel = {
  id: string;
  category: SessionAnalysisFacetCategory;
  categoryLabelIt: string;
  pillLabelIt: string;
  hintIt: string;
  source: SessionAnalysisFacetSource;
};

/**
 * Striscia multilivello per una singola sessione builder: pillole deterministiche da contract + knowledge packet.
 * Non sostituisce motori fisiologici né decisioni cliniche.
 */
/** Una casella per categoria fissa (striscia KPI), valore = driver principale per settore. */
export type SessionMultilevelStripSlotViewModel = {
  category: SessionAnalysisFacetCategory;
  shortLabelIt: string;
  valueLineIt: string;
  detailHintIt: string;
  facetId: string;
};

export type SessionMultilevelAnalysisStripViewModel = {
  modelVersion: number;
  layer: "deterministic_session_facet_template";
  facets: SessionAnalysisFacetViewModel[];
  /** Allineato a CATEGORY_ORDER: sempre tutte le categorie, valore “—” se assente. */
  stripSlots: SessionMultilevelStripSlotViewModel[];
  notes: string[];
};

