import type { KnowledgeQueryInput, KnowledgeQueryViewModel } from "@/api/knowledge/contracts";
import type { KnowledgeExpansionTrace, ResearchHopTrace } from "@/lib/empathy/schemas";
import { isMissingKnowledgeFoundationError } from "@/lib/knowledge/knowledge-foundation";
import {
  listKnowledgeAssertionIdsForLinks,
  searchKnowledgeCorpusDocumentLinks,
  searchKnowledgeCorpusDocuments,
} from "@/lib/knowledge/knowledge-library-store";
import {
  backfillKnowledgeCorpusIfSparse,
  enrichTraceHopDocumentsFromLiveLiterature,
} from "@/lib/knowledge/knowledge-trace-live-literature";

const GENERIC_TRACE_TAGS = new Set([
  "literature",
  "stimulus_interpretation",
  "mechanism_expansion",
  "reaction_expansion",
  "module_projection",
  "adaptation_target",
  "session_stimulus",
  "modulation_followup",
  "downstream_projection",
  "training",
  "nutrition",
  "health",
  "recovery",
  "physiology",
  "bioenergetics",
  "cross_module",
]);

function compactUnique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function humanizeToken(value: string) {
  return value.replaceAll(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function buildTraceSearchQueries(trace: KnowledgeExpansionTrace, hop: ResearchHopTrace) {
  const trigger = trace.trigger;
  const labels = compactUnique([
    trigger.stimulusLabel,
    trigger.entityLabel,
    trigger.adaptationTarget ? humanizeToken(trigger.adaptationTarget) : null,
  ]);
  const contextualTags = compactUnique(
    hop.contextTags
      .filter((tag) => !GENERIC_TRACE_TAGS.has(tag))
      .map((tag) => humanizeToken(tag)),
  );

  return compactUnique([
    ...labels,
    ...contextualTags,
    labels.join(" "),
    contextualTags.slice(0, 2).join(" "),
  ]).slice(0, 6);
}

export type ResolvedKnowledgeTraceHopLinks = {
  status: "complete";
  documentIds: string[];
  assertionIds: string[];
  resultSummary: string;
};

export async function resolveKnowledgeTraceHopLinks(input: {
  trace: KnowledgeExpansionTrace;
  hop: ResearchHopTrace;
  documentLimit?: number;
  assertionLimit?: number;
}): Promise<ResolvedKnowledgeTraceHopLinks> {
  const documentLimit = Math.max(1, Math.min(12, Math.trunc(input.documentLimit ?? 4) || 4));
  const assertionLimit = Math.max(1, Math.min(12, Math.trunc(input.assertionLimit ?? 6) || 6));
  const queries = buildTraceSearchQueries(input.trace, input.hop);
  const documentsById = new Map<string, string>();

  for (const query of queries) {
    if (documentsById.size >= documentLimit) break;
    const matches = await searchKnowledgeCorpusDocumentLinks(query, documentLimit);
    for (const match of matches) {
      documentsById.set(match.id, match.title);
      if (documentsById.size >= documentLimit) break;
    }
  }

  const liveAdded = await enrichTraceHopDocumentsFromLiveLiterature({
    hop: input.hop,
    queries,
    documentsById,
    documentLimit,
  });

  const documentIds = Array.from(documentsById.keys());
  const assertionIds = await listKnowledgeAssertionIdsForLinks({
    documentIds,
    contextTags: input.hop.contextTags,
    limit: assertionLimit,
  });
  const traceLabel =
    input.trace.trigger.stimulusLabel ??
    input.trace.trigger.entityLabel ??
    input.trace.trigger.adaptationTarget?.replaceAll("_", " ") ??
    "stimolo canonico";
  const liveSuffix =
    liveAdded > 0
      ? ` Ingest live letteratura: +${liveAdded} documento${liveAdded === 1 ? "" : "i"} (PubMed / Europe PMC).`
      : "";

  const resultSummary = documentIds.length || assertionIds.length
    ? `Linked ${documentIds.length} corpus document${documentIds.length === 1 ? "" : "s"} and ${assertionIds.length} mechanism assertion${assertionIds.length === 1 ? "" : "s"} for ${traceLabel}.${liveSuffix}`
    : liveAdded > 0
      ? `Ingest live letteratura: +${liveAdded} documento${liveAdded === 1 ? "" : "i"} (PubMed / Europe PMC) per ${traceLabel}.`
      : `No persisted corpus or mechanism links matched ${traceLabel} yet.`;

  return {
    status: "complete",
    documentIds,
    assertionIds,
    resultSummary,
  };
}

export async function resolveKnowledgeCorpusQuery(input: KnowledgeQueryInput): Promise<KnowledgeQueryViewModel> {
  try {
    await backfillKnowledgeCorpusIfSparse(input.q);
    const documents = await searchKnowledgeCorpusDocuments(input.q, 12);
    return {
      query: input,
      documents,
      entities: [],
      assertions: [],
      bindings: [],
      modulation: null,
      sessionKnowledge: null,
      error: null,
    };
  } catch (error) {
    if (isMissingKnowledgeFoundationError(error)) {
      return {
        query: input,
        documents: [],
        entities: [],
        assertions: [],
        bindings: [],
        modulation: null,
        sessionKnowledge: null,
        error: null,
      };
    }
    throw error;
  }
}
