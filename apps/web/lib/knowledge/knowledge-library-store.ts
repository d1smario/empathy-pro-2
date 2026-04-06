import type {
  AthleteKnowledgeBinding,
  KnowledgeDocumentRef,
  KnowledgeEntityRef,
  KnowledgeEvidenceLevel,
  KnowledgeModulationSnapshot,
  KnowledgePredicate,
  SessionKnowledgePacket,
} from "@/lib/empathy/schemas";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type KnowledgeDocumentUpsertInput = KnowledgeDocumentRef & {
  abstract?: string | null;
  documentKind?: string | null;
  license?: string | null;
  payload?: Record<string, unknown> | null;
};

type KnowledgeEntityUpsertInput = KnowledgeEntityRef & {
  metadata?: Record<string, unknown> | null;
};

type KnowledgeAssertionInsertInput = {
  subjectEntityId: string;
  predicate: KnowledgePredicate;
  objectEntityId?: string | null;
  contextTags?: string[];
  mechanismTags?: string[];
  evidenceLevel: KnowledgeEvidenceLevel;
  confidence: number;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function clampConfidence(value: number | null | undefined) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export async function upsertKnowledgeDocuments(rows: KnowledgeDocumentUpsertInput[]) {
  if (!rows.length) return [];
  const supabase = createServerSupabaseClient();
  const payload = rows.map((row) => ({
    source_db: row.sourceDb,
    external_id: row.externalId,
    title: row.title,
    abstract: row.abstract ?? null,
    url: row.url ?? null,
    journal: row.journal ?? null,
    publication_date: row.publicationDate ?? null,
    document_kind: row.documentKind ?? null,
    license: row.license ?? null,
    payload: row.payload ?? null,
  }));
  const { data, error } = await supabase
    .from("knowledge_documents")
    .upsert(payload, { onConflict: "source_db,external_id" })
    .select("id, source_db, external_id, title, url, journal, publication_date");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    sourceDb: String(row.source_db) as KnowledgeDocumentRef["sourceDb"],
    externalId: String(row.external_id),
    title: String(row.title),
    url: row.url ? String(row.url) : undefined,
    journal: row.journal ? String(row.journal) : undefined,
    publicationDate: row.publication_date ? String(row.publication_date) : undefined,
  }));
}

export async function upsertKnowledgeEntities(rows: KnowledgeEntityUpsertInput[]) {
  if (!rows.length) return [];
  const supabase = createServerSupabaseClient();
  const payload = rows.map((row) => ({
    entity_type: row.entityType,
    source_db: row.sourceDb,
    external_id: row.externalId,
    canonical_name: row.label,
    synonyms: row.synonyms ?? [],
    metadata: row.metadata ?? null,
  }));
  const { data, error } = await supabase
    .from("knowledge_entities")
    .upsert(payload, { onConflict: "entity_type,source_db,external_id" })
    .select("id, entity_type, source_db, external_id, canonical_name, synonyms");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    entityType: String(row.entity_type) as KnowledgeEntityRef["entityType"],
    sourceDb: String(row.source_db) as KnowledgeEntityRef["sourceDb"],
    externalId: String(row.external_id),
    label: String(row.canonical_name),
    synonyms: asStringArray(row.synonyms),
  }));
}

export async function insertKnowledgeAssertion(input: KnowledgeAssertionInsertInput) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("knowledge_assertions")
    .insert({
      subject_entity_id: input.subjectEntityId,
      predicate: input.predicate,
      object_entity_id: input.objectEntityId ?? null,
      context_tags: input.contextTags ?? [],
      mechanism_tags: input.mechanismTags ?? [],
      evidence_level: input.evidenceLevel,
      confidence: clampConfidence(input.confidence),
      notes: input.notes ?? null,
      metadata: input.metadata ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String(data.id);
}

export async function linkAssertionDocuments(input: {
  assertionId: string;
  documentIds: string[];
  primaryDocumentId?: string | null;
}) {
  if (!input.documentIds.length) return;
  const supabase = createServerSupabaseClient();
  const payload = input.documentIds.map((documentId, index) => ({
    assertion_id: input.assertionId,
    document_id: documentId,
    is_primary: input.primaryDocumentId === documentId,
    sort_order: index,
  }));
  const { error } = await supabase
    .from("knowledge_assertion_documents")
    .upsert(payload, { onConflict: "assertion_id,document_id" });
  if (error) throw new Error(error.message);
}

export async function listAthleteKnowledgeBindings(athleteId: string): Promise<AthleteKnowledgeBinding[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("athlete_knowledge_bindings")
    .select("id, athlete_id, domain, status, adaptation_target, session_date, planned_workout_id, triggered_by, context_tags, evidence_level, confidence, valid_from, valid_to")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    bindingId: String(row.id),
    athleteId: String(row.athlete_id),
    domain: String(row.domain) as AthleteKnowledgeBinding["domain"],
    status: String(row.status) as AthleteKnowledgeBinding["status"],
    triggeredBy: {
      physiologySignals: asStringArray((row.triggered_by as Record<string, unknown> | null)?.physiologySignals),
      twinSignals: asStringArray((row.triggered_by as Record<string, unknown> | null)?.twinSignals),
      healthSignals: asStringArray((row.triggered_by as Record<string, unknown> | null)?.healthSignals),
      nutritionSignals: asStringArray((row.triggered_by as Record<string, unknown> | null)?.nutritionSignals),
    },
    contextTags: asStringArray(row.context_tags),
    mechanismAssertions: [],
    evidenceLevel: String(row.evidence_level) as AthleteKnowledgeBinding["evidenceLevel"],
    confidence: clampConfidence(Number(row.confidence)),
    validFrom: row.valid_from ? String(row.valid_from) : undefined,
    validTo: row.valid_to ? String(row.valid_to) : undefined,
  }));
}

export async function listKnowledgeModulationSnapshots(athleteId: string): Promise<KnowledgeModulationSnapshot[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("knowledge_modulation_snapshots")
    .select("id, athlete_id, domain, adaptation_target, session_date, planned_workout_id, constraint_level, hard_constraints, soft_constraints, adaptive_flags, recommended_supports, blocked_supports, reasoning_summary, confidence, evidence_level, evidence_refs, created_at")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    snapshotId: String(row.id),
    athleteId: String(row.athlete_id),
    domain: String(row.domain) as KnowledgeModulationSnapshot["domain"],
    computedAt: String(row.created_at),
    adaptationTarget: row.adaptation_target ? String(row.adaptation_target) : undefined,
    plannedWorkoutId: row.planned_workout_id ? String(row.planned_workout_id) : undefined,
    sessionDate: row.session_date ? String(row.session_date) : undefined,
    constraintLevel: String(row.constraint_level) as KnowledgeModulationSnapshot["constraintLevel"],
    hardConstraints: asStringArray(row.hard_constraints),
    softConstraints: asStringArray(row.soft_constraints),
    adaptiveFlags: asStringArray(row.adaptive_flags),
    recommendedSupports: asStringArray(row.recommended_supports),
    blockedSupports: asStringArray(row.blocked_supports),
    reasoningSummary: row.reasoning_summary ? String(row.reasoning_summary) : undefined,
    confidence: clampConfidence(Number(row.confidence)),
    evidenceLevel: String(row.evidence_level) as KnowledgeModulationSnapshot["evidenceLevel"],
    supportingBindings: [],
    evidenceRefs: Array.isArray(row.evidence_refs) ? (row.evidence_refs as KnowledgeDocumentRef[]) : [],
  }));
}

export async function listSessionKnowledgePackets(athleteId: string): Promise<SessionKnowledgePacket[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("session_knowledge_packets")
    .select("id, athlete_id, planned_workout_id, session_date, adaptation_target, physiological_intent, primary_mechanisms, nutrition_supports, inhibitors_and_risks, evidence_level, confidence")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    packetId: String(row.id),
    athleteId: String(row.athlete_id),
    plannedWorkoutId: row.planned_workout_id ? String(row.planned_workout_id) : undefined,
    sessionDate: row.session_date ? String(row.session_date) : undefined,
    adaptationTarget: row.adaptation_target ? String(row.adaptation_target) : undefined,
    physiologicalIntent: asStringArray(row.physiological_intent),
    primaryMechanisms: asStringArray(row.primary_mechanisms),
    relevantPathways: [],
    relevantGenes: [],
    relevantProteins: [],
    relevantMetabolites: [],
    relevantMicrobiota: [],
    nutritionSupports: asStringArray(row.nutrition_supports),
    inhibitorsAndRisks: asStringArray(row.inhibitors_and_risks),
    modulation: null,
    evidenceRefs: [],
    confidence: clampConfidence(Number(row.confidence)),
    evidenceLevel: String(row.evidence_level) as SessionKnowledgePacket["evidenceLevel"],
    reasoningPolicy: {
      canExplain: true,
      canModulate: true,
      cannotOverrideDeterministicEngine: true,
    },
  }));
}

export async function searchKnowledgeCorpusDocuments(query: string, limit = 12): Promise<KnowledgeDocumentRef[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit) || 12));
  const pattern = `%${trimmedQuery}%`;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, source_db, external_id, title, url, journal, publication_date")
    .or(`title.ilike.${pattern},abstract.ilike.${pattern}`)
    .order("publication_date", { ascending: false })
    .limit(boundedLimit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    sourceDb: String(row.source_db) as KnowledgeDocumentRef["sourceDb"],
    externalId: String(row.external_id),
    title: String(row.title),
    url: row.url ? String(row.url) : undefined,
    journal: row.journal ? String(row.journal) : undefined,
    publicationDate: row.publication_date ? String(row.publication_date) : undefined,
  }));
}

export type KnowledgeCorpusDocumentLink = KnowledgeDocumentRef & {
  id: string;
};

export async function searchKnowledgeCorpusDocumentLinks(
  query: string,
  limit = 12,
): Promise<KnowledgeCorpusDocumentLink[]> {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) return [];
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit) || 12));
  const pattern = `%${trimmedQuery}%`;
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, source_db, external_id, title, url, journal, publication_date")
    .or(`title.ilike.${pattern},abstract.ilike.${pattern}`)
    .order("publication_date", { ascending: false })
    .limit(boundedLimit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    sourceDb: String(row.source_db) as KnowledgeDocumentRef["sourceDb"],
    externalId: String(row.external_id),
    title: String(row.title),
    url: row.url ? String(row.url) : undefined,
    journal: row.journal ? String(row.journal) : undefined,
    publicationDate: row.publication_date ? String(row.publication_date) : undefined,
  }));
}

export async function listKnowledgeAssertionIdsForLinks(input: {
  documentIds?: string[];
  contextTags?: string[];
  limit?: number;
}): Promise<string[]> {
  const documentIds = Array.from(new Set((input.documentIds ?? []).map((id) => String(id).trim()).filter(Boolean)));
  const contextTags = Array.from(new Set((input.contextTags ?? []).map((tag) => String(tag).trim()).filter(Boolean)));
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(input.limit ?? 12) || 12));
  const assertionIds = new Set<string>();
  const supabase = createServerSupabaseClient();

  if (documentIds.length) {
    const { data, error } = await supabase
      .from("knowledge_assertion_documents")
      .select("assertion_id")
      .in("document_id", documentIds)
      .limit(boundedLimit);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      assertionIds.add(String(row.assertion_id));
      if (assertionIds.size >= boundedLimit) {
        return Array.from(assertionIds);
      }
    }
  }

  if (contextTags.length && assertionIds.size < boundedLimit) {
    const { data, error } = await supabase
      .from("knowledge_assertions")
      .select("id")
      .overlaps("context_tags", contextTags)
      .order("updated_at", { ascending: false })
      .limit(boundedLimit);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      assertionIds.add(String(row.id));
      if (assertionIds.size >= boundedLimit) {
        break;
      }
    }
  }

  return Array.from(assertionIds);
}
