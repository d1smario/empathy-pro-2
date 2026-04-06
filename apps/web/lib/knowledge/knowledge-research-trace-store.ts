import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type {
  KnowledgeExpansionTrace,
  ResearchHopTrace,
  ResearchPlan,
  ResearchPlanStatus,
  ResearchPlannerTrigger,
} from "@/lib/empathy/schemas";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type TraceRow = {
  id: string;
  athlete_id: string | null;
  status: string;
  intents: unknown;
  payload: unknown;
  created_at: string;
  updated_at: string;
};

type HopRow = {
  id: string;
  trace_id?: string;
  hop_id: string;
  intent_id: string;
  hop_kind: string;
  status: string;
  question: string;
  source_dbs: unknown;
  expected_entity_types: unknown;
  context_tags: unknown;
  result_summary?: string | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeNullableText(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function buildTraceSignature(plan: ResearchPlan) {
  return JSON.stringify({
    trigger: {
      kind: plan.trigger.kind,
      athleteId: normalizeNullableText(plan.trigger.athleteId),
      module: normalizeNullableText(plan.trigger.module),
      adaptationTarget: normalizeNullableText(plan.trigger.adaptationTarget),
      stimulusLabel: normalizeNullableText(plan.trigger.stimulusLabel),
      entityLabel: normalizeNullableText(plan.trigger.entityLabel),
      sessionDate: normalizeNullableText(plan.trigger.sessionDate),
      plannedWorkoutId: normalizeNullableText(plan.trigger.plannedWorkoutId),
    },
    intents: plan.intents.map((intent) => ({
      kind: intent.kind,
      label: intent.label,
      contextTags: intent.contextTags,
    })),
    hops: plan.hops.map((hop) => ({
      intentId: hop.intentId,
      kind: hop.kind,
      question: hop.question,
      sourceDbs: hop.sourceDbs,
      expectedEntityTypes: hop.expectedEntityTypes,
      contextTags: hop.contextTags,
    })),
  });
}

function buildCanonicalTraceKey(plan: ResearchPlan) {
  return JSON.stringify({
    kind: plan.trigger.kind,
    athleteId: normalizeNullableText(plan.trigger.athleteId),
    module: normalizeNullableText(plan.trigger.module),
    adaptationTarget: normalizeNullableText(plan.trigger.adaptationTarget),
    stimulusLabel: normalizeNullableText(plan.trigger.stimulusLabel),
    entityLabel: normalizeNullableText(plan.trigger.entityLabel),
    sessionDate: normalizeNullableText(plan.trigger.sessionDate),
    plannedWorkoutId: normalizeNullableText(plan.trigger.plannedWorkoutId),
  });
}

function normalizeTrigger(payload: Record<string, unknown> | null | undefined): ResearchPlannerTrigger {
  return {
    kind: String(payload?.kind ?? "adaptation_target") as ResearchPlannerTrigger["kind"],
    athleteId: typeof payload?.athleteId === "string" ? payload.athleteId : undefined,
    module: typeof payload?.module === "string" ? (payload.module as ResearchPlannerTrigger["module"]) : undefined,
    adaptationTarget:
      typeof payload?.adaptationTarget === "string"
        ? (payload.adaptationTarget as ResearchPlannerTrigger["adaptationTarget"])
        : undefined,
    stimulusLabel: typeof payload?.stimulusLabel === "string" ? payload.stimulusLabel : undefined,
    entityLabel: typeof payload?.entityLabel === "string" ? payload.entityLabel : undefined,
    sessionDate: typeof payload?.sessionDate === "string" ? payload.sessionDate : undefined,
    plannedWorkoutId:
      typeof payload?.plannedWorkoutId === "string" ? payload.plannedWorkoutId : undefined,
  };
}

function normalizeHopTrace(
  row: Record<string, unknown> | HopRow,
  documentIds: string[],
  assertionIds: string[],
): ResearchHopTrace {
  return {
    traceHopId: String(row.id),
    hopId: String(row.hop_id),
    intentId: String(row.intent_id),
    kind: String(row.hop_kind) as ResearchHopTrace["kind"],
    status: String(row.status) as ResearchHopTrace["status"],
    question: String(row.question),
    sourceDbs: asStringArray(row.source_dbs) as ResearchHopTrace["sourceDbs"],
    expectedEntityTypes: asStringArray(row.expected_entity_types) as ResearchHopTrace["expectedEntityTypes"],
    contextTags: asStringArray(row.context_tags),
    resultSummary: typeof row.result_summary === "string" ? row.result_summary : undefined,
    linkedDocumentIds: documentIds,
    linkedAssertionIds: assertionIds,
  };
}

function toTraceModel(row: TraceRow, hops: ResearchHopTrace[]): KnowledgeExpansionTrace {
  return {
    traceId: String(row.id),
    athleteId: row.athlete_id ? String(row.athlete_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    status: String(row.status) as ResearchPlanStatus,
    trigger: normalizeTrigger(
      row.payload && typeof row.payload === "object"
        ? ((row.payload as Record<string, unknown>).trigger as Record<string, unknown> | undefined)
        : undefined,
    ),
    intents: Array.isArray(row.intents) ? (row.intents as ResearchPlan["intents"]) : [],
    hops,
  };
}

export function summarizeKnowledgeExpansionTrace(
  trace: KnowledgeExpansionTrace,
): KnowledgeResearchTraceSummary {
  const hopCounts = {
    total: trace.hops.length,
    planned: trace.hops.filter((hop) => hop.status === "planned").length,
    running: trace.hops.filter((hop) => hop.status === "running").length,
    complete: trace.hops.filter((hop) => hop.status === "complete").length,
  };
  const documentIds = new Set<string>();
  const assertionIds = new Set<string>();
  for (const hop of trace.hops) {
    for (const documentId of hop.linkedDocumentIds) documentIds.add(documentId);
    for (const assertionId of hop.linkedAssertionIds) assertionIds.add(assertionId);
  }

  return {
    traceId: trace.traceId,
    athleteId: trace.athleteId,
    status: trace.status,
    trigger: trace.trigger,
    createdAt: trace.createdAt,
    updatedAt: trace.updatedAt,
    hopCounts,
    linkCounts: {
      documents: documentIds.size,
      assertions: assertionIds.size,
    },
    latestResultSummary:
      [...trace.hops]
        .reverse()
        .find((hop) => typeof hop.resultSummary === "string" && hop.resultSummary.trim())?.resultSummary ?? null,
  };
}

async function loadTraceHops(traceIds: string[]) {
  const hopsByTraceId = new Map<string, ResearchHopTrace[]>();
  if (!traceIds.length) return hopsByTraceId;

  const supabase = createServerSupabaseClient();
  const { data: hops, error: hopsError } = await supabase
    .from("knowledge_expansion_trace_hops")
    .select("id, trace_id, hop_id, intent_id, hop_kind, status, question, source_dbs, expected_entity_types, context_tags, result_summary")
    .in("trace_id", traceIds)
    .order("created_at", { ascending: true });
  if (hopsError) throw new Error(hopsError.message);

  const hopIds = (hops ?? []).map((row) => String(row.id));
  const documentsByHopId = new Map<string, string[]>();
  const assertionsByHopId = new Map<string, string[]>();

  if (hopIds.length) {
    const [{ data: documents, error: documentsError }, { data: assertions, error: assertionsError }] =
      await Promise.all([
        supabase
          .from("knowledge_expansion_trace_hop_documents")
          .select("trace_hop_id, document_id")
          .in("trace_hop_id", hopIds),
        supabase
          .from("knowledge_expansion_trace_hop_assertions")
          .select("trace_hop_id, assertion_id")
          .in("trace_hop_id", hopIds),
      ]);
    if (documentsError) throw new Error(documentsError.message);
    if (assertionsError) throw new Error(assertionsError.message);

    for (const row of documents ?? []) {
      const key = String(row.trace_hop_id);
      const current = documentsByHopId.get(key) ?? [];
      current.push(String(row.document_id));
      documentsByHopId.set(key, current);
    }
    for (const row of assertions ?? []) {
      const key = String(row.trace_hop_id);
      const current = assertionsByHopId.get(key) ?? [];
      current.push(String(row.assertion_id));
      assertionsByHopId.set(key, current);
    }
  }

  for (const row of hops ?? []) {
    const traceId = String(row.trace_id);
    const current = hopsByTraceId.get(traceId) ?? [];
    current.push(
      normalizeHopTrace(
        row as HopRow,
        documentsByHopId.get(String(row.id)) ?? [],
        assertionsByHopId.get(String(row.id)) ?? [],
      ),
    );
    hopsByTraceId.set(traceId, current);
  }

  return hopsByTraceId;
}

export async function getKnowledgeExpansionTraceById(
  traceId: string,
): Promise<KnowledgeExpansionTrace | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("knowledge_expansion_traces")
    .select("id, athlete_id, status, intents, payload, created_at, updated_at")
    .eq("id", traceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const hopsByTraceId = await loadTraceHops([traceId]);
  return toTraceModel(data as TraceRow, hopsByTraceId.get(traceId) ?? []);
}

async function findExistingTraceBySignature(plan: ResearchPlan): Promise<KnowledgeExpansionTrace | null> {
  const supabase = createServerSupabaseClient();
  const athleteId = normalizeNullableText(plan.trigger.athleteId);
  let query = supabase
    .from("knowledge_expansion_traces")
    .select("id, athlete_id, status, intents, payload, created_at, updated_at")
    .eq("trigger_kind", plan.trigger.kind)
    .order("created_at", { ascending: false })
    .limit(8);

  query = athleteId ? query.eq("athlete_id", athleteId) : query.is("athlete_id", null);

  const moduleValue = normalizeNullableText(plan.trigger.module);
  query = moduleValue ? query.eq("module", moduleValue) : query.is("module", null);

  const adaptationTarget = normalizeNullableText(plan.trigger.adaptationTarget);
  query = adaptationTarget
    ? query.eq("adaptation_target", adaptationTarget)
    : query.is("adaptation_target", null);

  const stimulusLabel = normalizeNullableText(plan.trigger.stimulusLabel);
  query = stimulusLabel ? query.eq("stimulus_label", stimulusLabel) : query.is("stimulus_label", null);

  const entityLabel = normalizeNullableText(plan.trigger.entityLabel);
  query = entityLabel ? query.eq("entity_label", entityLabel) : query.is("entity_label", null);

  const sessionDate = normalizeNullableText(plan.trigger.sessionDate);
  query = sessionDate ? query.eq("session_date", sessionDate) : query.is("session_date", null);

  const plannedWorkoutId = normalizeNullableText(plan.trigger.plannedWorkoutId);
  query = plannedWorkoutId
    ? query.eq("planned_workout_id", plannedWorkoutId)
    : query.is("planned_workout_id", null);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const signature = buildTraceSignature(plan);
  const canonicalKey = buildCanonicalTraceKey(plan);
  const existing = (data ?? []).find((row) => {
    const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
    return (
      String(payload.canonicalKey ?? "") === canonicalKey ||
      String(payload.signature ?? "") === signature ||
      (String(payload.planId ?? "") && String(payload.planId ?? "") === plan.planId)
    );
  });

  if (!existing) return null;
  return getKnowledgeExpansionTraceById(String(existing.id));
}

export async function persistKnowledgeExpansionTrace(plan: ResearchPlan): Promise<KnowledgeExpansionTrace> {
  const existing = await findExistingTraceBySignature(plan);
  if (existing) return existing;
  return insertKnowledgeExpansionTrace(plan);
}

export async function insertKnowledgeExpansionTrace(plan: ResearchPlan): Promise<KnowledgeExpansionTrace> {
  const supabase = createServerSupabaseClient();
  const signature = buildTraceSignature(plan);
  const canonicalKey = buildCanonicalTraceKey(plan);
  const { data: traceRow, error: traceError } = await supabase
    .from("knowledge_expansion_traces")
    .insert({
      athlete_id: plan.trigger.athleteId ?? null,
      planned_workout_id: plan.trigger.plannedWorkoutId ?? null,
      trigger_kind: plan.trigger.kind,
      module: plan.trigger.module ?? null,
      adaptation_target: plan.trigger.adaptationTarget ?? null,
      stimulus_label: plan.trigger.stimulusLabel ?? null,
      entity_label: plan.trigger.entityLabel ?? null,
      session_date: plan.trigger.sessionDate ?? null,
      status: plan.status,
      intents: plan.intents,
      payload: {
        trigger: plan.trigger,
        planId: plan.planId,
        canonicalKey,
        signature,
      },
    })
    .select("id, athlete_id, status, intents, payload, created_at, updated_at")
    .single();
  if (traceError) throw new Error(traceError.message);

  const traceId = String(traceRow.id);
  const hopInsertRows = plan.hops.map((hop) => ({
    trace_id: traceId,
    hop_id: hop.hopId,
    intent_id: hop.intentId,
    hop_kind: hop.kind,
    status: "planned",
    question: hop.question,
    source_dbs: hop.sourceDbs,
    expected_entity_types: hop.expectedEntityTypes,
    context_tags: hop.contextTags,
  }));
  const { data: hopRows, error: hopError } = await supabase
    .from("knowledge_expansion_trace_hops")
    .insert(hopInsertRows)
    .select("id, hop_id, intent_id, hop_kind, status, question, source_dbs, expected_entity_types, context_tags, result_summary");
  if (hopError) throw new Error(hopError.message);

  return toTraceModel(
    traceRow as TraceRow,
    (hopRows ?? []).map((row) => normalizeHopTrace(row as HopRow, [], [])),
  );
}

type TraceListOptions = {
  limit?: number;
  modules?: Array<NonNullable<ResearchPlannerTrigger["module"]>>;
};

function normalizeTraceListOptions(limitOrOptions: number | TraceListOptions | undefined): TraceListOptions {
  if (typeof limitOrOptions === "number") {
    return { limit: limitOrOptions };
  }
  return limitOrOptions ?? {};
}

export async function listKnowledgeExpansionTraces(
  athleteId: string,
  limitOrOptions: number | TraceListOptions = 12,
) {
  const options = normalizeTraceListOptions(limitOrOptions);
  const supabase = createServerSupabaseClient();
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(options.limit ?? 12) || 12));
  let query = supabase
    .from("knowledge_expansion_traces")
    .select("id, athlete_id, status, intents, payload, created_at, updated_at")
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(boundedLimit);
  if (options.modules?.length) {
    query = query.in("module", options.modules);
  }
  const { data: traces, error } = await query;
  if (error) throw new Error(error.message);

  const traceIds = (traces ?? []).map((row) => String(row.id));
  const hopsByTraceId = await loadTraceHops(traceIds);

  return (traces ?? []).map((row) =>
    toTraceModel(row as TraceRow, hopsByTraceId.get(String(row.id)) ?? []),
  );
}

export async function listKnowledgeExpansionTraceSummaries(
  athleteId: string,
  limitOrOptions: number | TraceListOptions = 12,
) {
  const traces = await listKnowledgeExpansionTraces(athleteId, limitOrOptions);
  return traces.map((trace) => summarizeKnowledgeExpansionTrace(trace));
}

export async function getKnowledgeExpansionTraceHopContext(traceHopId: string): Promise<{
  trace: KnowledgeExpansionTrace;
  hop: ResearchHopTrace;
} | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("knowledge_expansion_trace_hops")
    .select("id, trace_id")
    .eq("id", traceHopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.trace_id) return null;

  const trace = await getKnowledgeExpansionTraceById(String(data.trace_id));
  if (!trace) return null;
  const hop = trace.hops.find((candidate) => candidate.traceHopId === traceHopId);
  if (!hop) return null;

  return { trace, hop };
}

export async function linkKnowledgeExpansionTraceHop(input: {
  traceHopId: string;
  status?: ResearchHopTrace["status"];
  resultSummary?: string | null;
  documentIds?: string[];
  assertionIds?: string[];
}): Promise<ResearchHopTrace> {
  const supabase = createServerSupabaseClient();
  const nextStatus = input.status ?? "complete";
  const { data: updatedHop, error: updateError } = await supabase
    .from("knowledge_expansion_trace_hops")
    .update({
      status: nextStatus,
      result_summary: input.resultSummary ?? null,
    })
    .eq("id", input.traceHopId)
    .select("id, hop_id, intent_id, hop_kind, status, question, source_dbs, expected_entity_types, context_tags, result_summary")
    .single();
  if (updateError) throw new Error(updateError.message);

  const documentIds = Array.from(new Set((input.documentIds ?? []).map((id) => String(id).trim()).filter(Boolean)));
  const assertionIds = Array.from(new Set((input.assertionIds ?? []).map((id) => String(id).trim()).filter(Boolean)));

  if (documentIds.length) {
    const { error: documentsError } = await supabase
      .from("knowledge_expansion_trace_hop_documents")
      .upsert(
        documentIds.map((documentId) => ({
          trace_hop_id: input.traceHopId,
          document_id: documentId,
        })),
        { onConflict: "trace_hop_id,document_id" },
      );
    if (documentsError) throw new Error(documentsError.message);
  }

  if (assertionIds.length) {
    const { error: assertionsError } = await supabase
      .from("knowledge_expansion_trace_hop_assertions")
      .upsert(
        assertionIds.map((assertionId) => ({
          trace_hop_id: input.traceHopId,
          assertion_id: assertionId,
        })),
        { onConflict: "trace_hop_id,assertion_id" },
      );
    if (assertionsError) throw new Error(assertionsError.message);
  }

  return normalizeHopTrace(updatedHop as Record<string, unknown>, documentIds, assertionIds);
}
