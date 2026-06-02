/**
 * EMPATHY — Framework interrogativo L1–L10 + Application Playbook (Interpretation layer).
 * Numeri canonici restano in Compute; questo schema descrive domande, settori e consigli operativi.
 */

export const EMPATHY_INTERROGATION_CATALOG_V1 = "empathy.interrogation.catalog_v1" as const;
export const EMPATHY_INTERROGATION_POLICY_V1 = "empathy.interrogation.policy_v1" as const;

export type EmpathyInterrogationLevelId =
  | "L1_stimulus"
  | "L2_energy_systems"
  | "L3_molecular_pathways"
  | "L4_neuroendocrine"
  | "L5_microbiota"
  | "L6_environment"
  | "L7_bioenergetics"
  | "L8_gene_networks"
  | "L9_interrogation"
  | "L10_decision";

export type EmpathyInvestigationSectorId =
  | "training"
  | "energy_systems"
  | "molecular_pathways"
  | "neuroendocrine"
  | "microbiota"
  | "environment"
  | "bioenergetics"
  | "gene_networks"
  | "biomarkers"
  | "gaps"
  | "nutrition_levers"
  | "fueling_levers"
  | "recovery_levers";

export type EmpathyProbeStatus = "active" | "answered" | "deferred" | "not_applicable";

export type EmpathyAdviceConfidence =
  | "engine_derived"
  | "session_knowledge"
  | "health_lab"
  | "trace_summary"
  | "deferred_future";

export type EmpathyApplicationLeverTarget =
  | "nutrition"
  | "fueling"
  | "training"
  | "recovery"
  | "supplement"
  | "microbiota"
  | "environment"
  | "dashboard_kpi";

export type EmpathyInterrogationQuestionDef = {
  id: string;
  levelId: EmpathyInterrogationLevelId;
  sectorId: EmpathyInvestigationSectorId;
  promptIt: string;
  rationaleIt: string;
  probeKey: string;
  priority: number;
};

export type EmpathyInterrogationSectorState = {
  sectorId: EmpathyInvestigationSectorId;
  status: EmpathyProbeStatus;
  summaryIt: string;
  evidenceRefs: string[];
  linkedQuestionIds: string[];
};

export type EmpathyInterrogationLevelState = {
  levelId: EmpathyInterrogationLevelId;
  labelIt: string;
  sectors: EmpathyInterrogationSectorState[];
};

export type EmpathyCanonicalQuestionAnswer = {
  questionId: string;
  promptIt: string;
  status: EmpathyProbeStatus;
  answerIt: string;
  evidenceRefs: string[];
  deferredProbeKey?: string;
};

export type EmpathyInterrogationMap = {
  schemaVersion: 1;
  policyVersion: string;
  catalogVersion: string;
  athleteId: string;
  anchorDate: string;
  headlineIt: string;
  levels: EmpathyInterrogationLevelState[];
  canonicalQuestions: EmpathyCanonicalQuestionAnswer[];
  activatedPathwayLabels: string[];
  activatedEnergySystems: string[];
  activatedGeneNetworks: string[];
};

export type EmpathyNutritionAdviceItem = {
  id: string;
  slotHint?: string;
  headlineIt: string;
  actionIt: string;
  timingWindowIt: string;
  rationaleIt: string;
  confidence: EmpathyAdviceConfidence;
  evidenceRefs: string[];
  linkedComputeRefs: string[];
};

export type EmpathyFuelingIntegrationHint = {
  productClass: string;
  reasonIt: string;
  timingIt: string;
};

export type EmpathyFuelingAdvice = {
  sessionLabel: string;
  choPerHourRef?: string;
  tierBandRef?: string;
  hydrationRef?: string;
  integrationFavoring: EmpathyFuelingIntegrationHint[];
  protocolNotes: string[];
  evidenceRefs: string[];
};

export type EmpathyTimingProtocol = {
  id: string;
  phase: string;
  windowLabelIt: string;
  actionsIt: string[];
  pathwayLabel?: string;
  confidence: EmpathyAdviceConfidence;
  evidenceRefs: string[];
};

export type EmpathyAdvisoryNote = {
  id: string;
  sector: EmpathyInvestigationSectorId;
  textIt: string;
  confidence: EmpathyAdviceConfidence;
  evidenceRefs: string[];
};

export type EmpathyGapAnalysisItem = {
  nutrientOrCofactor: string;
  status: "adequate" | "low_signal" | "deferred";
  detailIt: string;
  evidenceRefs: string[];
};

export type EmpathyOperationalDirective = {
  id: string;
  sector: EmpathyInvestigationSectorId;
  headlineIt: string;
  actionIt: string;
  timingWindowIt: string;
  severity: "info" | "watch" | "priority";
  confidence: EmpathyAdviceConfidence;
  evidenceRefs: string[];
  leverTargets: EmpathyApplicationLeverTarget[];
};

export type EmpathyApplicationPlaybook = {
  schemaVersion: 1;
  policyVersion: string;
  athleteId: string;
  anchorDate: string;
  playbookHeadlineIt: string;
  nutritionAdvice: EmpathyNutritionAdviceItem[];
  fuelingAdvice: EmpathyFuelingAdvice | null;
  timingProtocols: EmpathyTimingProtocol[];
  advisoryNotes: EmpathyAdvisoryNote[];
  supplementHints: string[];
  directives: EmpathyOperationalDirective[];
  gapAnalysis: EmpathyGapAnalysisItem[];
  disclaimerIt: string;
};

export type EmpathyInterrogationBundle = {
  interrogationMap: EmpathyInterrogationMap;
  applicationPlaybook: EmpathyApplicationPlaybook;
};
