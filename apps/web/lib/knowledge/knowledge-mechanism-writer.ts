import type { KnowledgeMechanismUpsertInput } from "@/api/knowledge/contracts";
import type { KnowledgeMechanismAssertion } from "@/lib/empathy/schemas";
import {
  insertKnowledgeAssertion,
  linkAssertionDocuments,
  upsertKnowledgeDocuments,
  upsertKnowledgeEntities,
} from "@/lib/knowledge/knowledge-library-store";

export async function createKnowledgeMechanism(
  input: KnowledgeMechanismUpsertInput,
): Promise<KnowledgeMechanismAssertion> {
  const subjectRows = await upsertKnowledgeEntities([input.subject]);
  const subjectRow = subjectRows[0];
  if (!subjectRow?.id) {
    throw new Error("Unable to resolve subject entity");
  }

  const objectRow = input.object ? (await upsertKnowledgeEntities([input.object]))[0] : null;
  const documentRows = await upsertKnowledgeDocuments(input.documents);
  const assertionId = await insertKnowledgeAssertion({
    subjectEntityId: subjectRow.id,
    predicate: input.predicate,
    objectEntityId: objectRow?.id ?? null,
    contextTags: input.contextTags ?? [],
    mechanismTags: input.mechanismTags ?? [],
    evidenceLevel: input.evidenceLevel,
    confidence: input.confidence,
    notes: input.notes ?? null,
    metadata: {
      source: "manual_curation",
    },
  });

  await linkAssertionDocuments({
    assertionId,
    documentIds: documentRows.map((row) => row.id).filter(Boolean),
    primaryDocumentId: documentRows[0]?.id ?? null,
  });

  return {
    id: assertionId,
    subject: {
      entityType: subjectRow.entityType,
      sourceDb: subjectRow.sourceDb,
      externalId: subjectRow.externalId,
      label: subjectRow.label,
      synonyms: subjectRow.synonyms,
    },
    predicate: input.predicate,
    object: objectRow
      ? {
          entityType: objectRow.entityType,
          sourceDb: objectRow.sourceDb,
          externalId: objectRow.externalId,
          label: objectRow.label,
          synonyms: objectRow.synonyms,
        }
      : null,
    contextTags: input.contextTags ?? [],
    mechanismTags: input.mechanismTags ?? [],
    evidenceLevel: input.evidenceLevel,
    confidence: input.confidence,
    documents: documentRows.map((row) => ({
      sourceDb: row.sourceDb,
      externalId: row.externalId,
      title: row.title,
      url: row.url,
      journal: row.journal,
      publicationDate: row.publicationDate,
    })),
    notes: input.notes ?? undefined,
  };
}
