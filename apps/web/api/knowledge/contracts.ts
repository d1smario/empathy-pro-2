import type {
  AthleteKnowledgeBinding,
  KnowledgeDocumentRef,
  KnowledgeEntityRef,
  KnowledgeExpansionTrace,
  KnowledgeMechanismAssertion,
  KnowledgeModulationSnapshot,
  ResearchPlan,
  ResearchPlanStatus,
  ResearchPlannerTrigger,
  SessionKnowledgePacket,
} from "@/lib/empathy/schemas";

export type KnowledgeQueryInput = {
  q: string;
  athleteId?: string;
  module?: "training" | "nutrition" | "health" | "recovery" | "physiology";
  adaptationTarget?: string;
  sessionDate?: string;
  plannedWorkoutId?: string;
  entityTypes?: string[];
  contextTags?: string[];
};

export type KnowledgeQueryViewModel = {
  query: KnowledgeQueryInput;
  documents: KnowledgeDocumentRef[];
  entities: KnowledgeEntityRef[];
  assertions: KnowledgeMechanismAssertion[];
  bindings: AthleteKnowledgeBinding[];
  modulation: KnowledgeModulationSnapshot | null;
  sessionKnowledge: SessionKnowledgePacket | null;
  error?: string | null;
};

export type KnowledgeBindingViewModel = {
  athleteId: string;
  bindings: AthleteKnowledgeBinding[];
  activeModulations: KnowledgeModulationSnapshot[];
  recentSessionPackets: SessionKnowledgePacket[];
  error?: string | null;
};

export type KnowledgeCorpusImportInput =
  | { source: "pubmed"; q: string; maxItems?: number }
  | { source: "europe_pmc"; q: string; maxItems?: number };

export type KnowledgeCorpusImportResult =
  | {
      source: "pubmed";
      query: string;
      importedCount: number;
      documents: KnowledgeDocumentRef[];
      error?: string | null;
    }
  | {
      source: "europe_pmc";
      query: string;
      importedCount: number;
      documents: KnowledgeDocumentRef[];
      error?: string | null;
    };

export type KnowledgeMechanismUpsertInput = {
  subject: KnowledgeEntityRef;
  predicate: KnowledgeMechanismAssertion["predicate"];
  object?: KnowledgeEntityRef | null;
  contextTags?: string[];
  mechanismTags?: string[];
  evidenceLevel: KnowledgeMechanismAssertion["evidenceLevel"];
  confidence: number;
  documents: KnowledgeDocumentRef[];
  notes?: string | null;
};

export type KnowledgeMechanismUpsertResult = {
  assertion: KnowledgeMechanismAssertion | null;
  error?: string | null;
};

export type KnowledgeResearchPlanInput = {
  trigger: ResearchPlannerTrigger;
};

export type KnowledgeResearchPlanViewModel = {
  plan: ResearchPlan | null;
  error?: string | null;
};

export type KnowledgeResearchTraceSaveInput = {
  plan: ResearchPlan;
};

export type KnowledgeResearchTraceSummary = {
  traceId: string;
  athleteId?: string;
  status: ResearchPlanStatus;
  trigger: ResearchPlannerTrigger;
  createdAt: string;
  updatedAt: string;
  hopCounts: {
    total: number;
    planned: number;
    running: number;
    complete: number;
  };
  linkCounts: {
    documents: number;
    assertions: number;
  };
  latestResultSummary?: string | null;
};

export type KnowledgeResearchTraceViewModel = {
  trace: KnowledgeExpansionTrace | null;
  summary?: KnowledgeResearchTraceSummary | null;
  error?: string | null;
};

export type KnowledgeResearchTraceListViewModel = {
  athleteId: string;
  traces: KnowledgeResearchTraceSummary[];
  /** Full trace with intents + hops when `GET .../research-traces?expand=expansion` */
  expansionTraces?: KnowledgeExpansionTrace[];
  error?: string | null;
};

export type KnowledgeResearchHopLinkInput = {
  athleteId: string;
  traceHopId: string;
  status?: "planned" | "running" | "complete";
  resultSummary?: string | null;
  documentIds?: string[];
  assertionIds?: string[];
  autoResolve?: boolean;
};

export type KnowledgeResearchHopLinkViewModel = {
  hop: import("@/lib/empathy/schemas").ResearchHopTrace | null;
  traceSummary?: KnowledgeResearchTraceSummary | null;
  error?: string | null;
};
