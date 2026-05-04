import type { ConstraintLevel, IsoDate, IsoDateTime } from "./common";

export type KnowledgeSourceDatabase =
  | "pubmed"
  | "europe_pmc"
  | "reactome"
  | "uniprot"
  | "kegg"
  | "hmdb"
  | "chebi"
  | "chembl"
  | "mgnify"
  | "encode"
  | "ensembl"
  | "ncbi_gene"
  | "gene_ontology"
  | "metacyc"
  | "rhea"
  | "manual_curation";

export type KnowledgeEntityType =
  | "gene"
  | "protein"
  | "pathway"
  | "metabolite"
  | "microbe"
  | "nutrient"
  | "biomarker"
  | "hormone"
  | "phenotype"
  | "process";

export type KnowledgePredicate =
  | "activates"
  | "inhibits"
  | "modulates"
  | "supports"
  | "requires"
  | "depletes"
  | "produces"
  | "consumes"
  | "associates_with"
  | "correlates_with";

export type KnowledgeEvidenceLevel = "strong" | "moderate" | "weak" | "exploratory";

export type KnowledgeContextDomain =
  | "training"
  | "nutrition"
  | "health"
  | "recovery"
  | "physiology"
  | "bioenergetics"
  | "cross_module";

export type KnowledgeEntityRef = {
  entityType: KnowledgeEntityType;
  sourceDb: KnowledgeSourceDatabase;
  externalId: string;
  label: string;
  synonyms?: string[];
};

export type KnowledgeDocumentRef = {
  sourceDb: KnowledgeSourceDatabase;
  externalId: string;
  title: string;
  url?: string;
  publicationDate?: string | null;
  journal?: string | null;
};

export type KnowledgeMechanismAssertion = {
  id: string;
  subject: KnowledgeEntityRef;
  predicate: KnowledgePredicate;
  object?: KnowledgeEntityRef | null;
  contextTags: string[];
  mechanismTags: string[];
  evidenceLevel: KnowledgeEvidenceLevel;
  confidence: number;
  documents: KnowledgeDocumentRef[];
  notes?: string;
};

export type AthleteKnowledgeBinding = {
  bindingId: string;
  athleteId: string;
  domain: KnowledgeContextDomain;
  status: "candidate" | "active" | "archived";
  triggeredBy: {
    physiologySignals: string[];
    twinSignals: string[];
    healthSignals: string[];
    nutritionSignals: string[];
  };
  contextTags: string[];
  mechanismAssertions: KnowledgeMechanismAssertion[];
  evidenceLevel: KnowledgeEvidenceLevel;
  confidence: number;
  validFrom?: IsoDate;
  validTo?: IsoDate;
};

export type KnowledgeModulationSnapshot = {
  snapshotId: string;
  athleteId: string;
  domain: KnowledgeContextDomain;
  computedAt: IsoDateTime;
  adaptationTarget?: string;
  plannedWorkoutId?: string;
  sessionDate?: IsoDate;
  constraintLevel: ConstraintLevel;
  hardConstraints: string[];
  softConstraints: string[];
  adaptiveFlags: string[];
  recommendedSupports: string[];
  blockedSupports: string[];
  reasoningSummary?: string;
  confidence: number;
  evidenceLevel: KnowledgeEvidenceLevel;
  supportingBindings: string[];
  evidenceRefs: KnowledgeDocumentRef[];
};

export type SessionKnowledgePacket = {
  packetId: string;
  athleteId: string;
  sessionDate?: IsoDate;
  plannedWorkoutId?: string;
  adaptationTarget?: string;
  physiologicalIntent: string[];
  primaryMechanisms: string[];
  relevantPathways: KnowledgeEntityRef[];
  relevantGenes: KnowledgeEntityRef[];
  relevantProteins: KnowledgeEntityRef[];
  relevantMetabolites: KnowledgeEntityRef[];
  relevantMicrobiota: KnowledgeEntityRef[];
  nutritionSupports: string[];
  inhibitorsAndRisks: string[];
  modulation: KnowledgeModulationSnapshot | null;
  evidenceRefs: KnowledgeDocumentRef[];
  confidence: number;
  evidenceLevel: KnowledgeEvidenceLevel;
  reasoningPolicy: {
    canExplain: true;
    canModulate: true;
    cannotOverrideDeterministicEngine: true;
  };
};

export type AthleteKnowledgeMemory = {
  bindings: AthleteKnowledgeBinding[];
  activeModulations: KnowledgeModulationSnapshot[];
  recentSessionPackets: SessionKnowledgePacket[];
};
