import type { AdaptationTarget } from "./training-engine";
import type { KnowledgeContextDomain, KnowledgeEntityType, KnowledgeSourceDatabase } from "./knowledge";
import type { IsoDateTime } from "./common";

export type ResearchTriggerKind =
  | "adaptation_target"
  | "session_stimulus"
  | "mechanism_entity"
  | "modulation_followup"
  | "downstream_projection";

export type ResearchIntentKind =
  | "stimulus_interpretation"
  | "mechanism_expansion"
  | "pathway_expansion"
  | "reaction_expansion"
  | "module_projection";

export type ResearchHopKind =
  | "literature_search"
  | "entity_lookup"
  | "pathway_lookup"
  | "reaction_lookup"
  | "projection_review";

export type ResearchPlanStatus = "draft" | "ready" | "running" | "complete";

export type ResearchPlannerTrigger = {
  kind: ResearchTriggerKind;
  athleteId?: string;
  module?: KnowledgeContextDomain;
  adaptationTarget?: AdaptationTarget;
  stimulusLabel?: string;
  entityLabel?: string;
  sessionDate?: string;
  plannedWorkoutId?: string;
};

export type ResearchIntent = {
  intentId: string;
  kind: ResearchIntentKind;
  label: string;
  rationale: string;
  contextTags: string[];
  sourcePriority: KnowledgeSourceDatabase[];
};

export type ResearchHop = {
  hopId: string;
  intentId: string;
  kind: ResearchHopKind;
  question: string;
  sourceDbs: KnowledgeSourceDatabase[];
  expectedEntityTypes: KnowledgeEntityType[];
  contextTags: string[];
};

export type ResearchPlan = {
  planId: string;
  createdAt: IsoDateTime;
  status: ResearchPlanStatus;
  trigger: ResearchPlannerTrigger;
  intents: ResearchIntent[];
  hops: ResearchHop[];
};

export type ResearchHopTrace = ResearchHop & {
  traceHopId: string;
  status: "planned" | "running" | "complete";
  resultSummary?: string;
  linkedDocumentIds: string[];
  linkedAssertionIds: string[];
};

export type KnowledgeExpansionTrace = {
  traceId: string;
  athleteId?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  status: ResearchPlanStatus;
  trigger: ResearchPlannerTrigger;
  intents: ResearchIntent[];
  hops: ResearchHopTrace[];
};
