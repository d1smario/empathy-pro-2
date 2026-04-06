import type { KnowledgeResearchPlanInput } from "@/api/knowledge/contracts";
import type {
  ResearchHop,
  ResearchIntent,
  ResearchPlan,
  ResearchPlannerTrigger,
} from "@/lib/empathy/schemas";

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function triggerLabel(trigger: ResearchPlannerTrigger) {
  if (trigger.stimulusLabel?.trim()) return trigger.stimulusLabel.trim();
  if (trigger.adaptationTarget?.trim()) return trigger.adaptationTarget.trim();
  if (trigger.entityLabel?.trim()) return trigger.entityLabel.trim();
  return trigger.kind;
}

function sourcePriorityForIntent(kind: ResearchIntent["kind"]): ResearchIntent["sourcePriority"] {
  if (kind === "stimulus_interpretation") return ["pubmed", "europe_pmc"];
  if (kind === "mechanism_expansion") return ["reactome", "gene_ontology", "uniprot", "ncbi_gene"];
  if (kind === "pathway_expansion") return ["reactome", "kegg", "metacyc", "gene_ontology"];
  if (kind === "reaction_expansion") return ["hmdb", "chebi", "metacyc", "uniprot"];
  return ["pubmed", "reactome", "hmdb", "mgnify"];
}

function intentsForTrigger(trigger: ResearchPlannerTrigger): ResearchIntent[] {
  const label = triggerLabel(trigger);
  const baseTags = [trigger.kind, trigger.module ?? "cross_module", trigger.adaptationTarget ?? slug(label)];

  return [
    {
      intentId: "intent-stimulus",
      kind: "stimulus_interpretation",
      label: `Interpret stimulus: ${label}`,
      rationale: "Translate the training or biological trigger into canonical physiological and mechanistic intents.",
      contextTags: [...baseTags, "stimulus_interpretation"],
      sourcePriority: sourcePriorityForIntent("stimulus_interpretation"),
    },
    {
      intentId: "intent-mechanisms",
      kind: "mechanism_expansion",
      label: `Expand mechanisms for ${label}`,
      rationale: "Expand from the initial stimulus to signaling molecules, hormones, genes, proteins, and pathway-level mechanisms.",
      contextTags: [...baseTags, "mechanism_expansion"],
      sourcePriority: sourcePriorityForIntent("mechanism_expansion"),
    },
    {
      intentId: "intent-reactions",
      kind: "reaction_expansion",
      label: `Expand cofactors and reactions for ${label}`,
      rationale: "Resolve metabolites, cofactors, vitamins, minerals, and inhibitors/facilitators around the main pathways.",
      contextTags: [...baseTags, "reaction_expansion"],
      sourcePriority: sourcePriorityForIntent("reaction_expansion"),
    },
    {
      intentId: "intent-projection",
      kind: "module_projection",
      label: `Project ${label} to modules`,
      rationale: "Project the scientific material into training, nutrition, fueling, recovery, microbiota, and health guidance.",
      contextTags: [...baseTags, "module_projection"],
      sourcePriority: sourcePriorityForIntent("module_projection"),
    },
  ];
}

function hop(
  hopId: string,
  intentId: string,
  kind: ResearchHop["kind"],
  question: string,
  sourceDbs: ResearchHop["sourceDbs"],
  expectedEntityTypes: ResearchHop["expectedEntityTypes"],
  contextTags: string[],
): ResearchHop {
  return {
    hopId,
    intentId,
    kind,
    question,
    sourceDbs,
    expectedEntityTypes,
    contextTags,
  };
}

function hopsForTrigger(trigger: ResearchPlannerTrigger): ResearchHop[] {
  const label = triggerLabel(trigger);
  const adaptationTarget = trigger.adaptationTarget?.replaceAll("_", " ") ?? label;
  const normalized = label.toLowerCase();
  const isSprintLike =
    /z7|sprint|maximal|maximali|alactic|neuromuscular|power/.test(normalized) ||
    trigger.adaptationTarget === "power_output" ||
    trigger.adaptationTarget === "max_strength";

  const stimulusQuestion = isSprintLike
    ? `Which physiological systems, signaling molecules, endocrine responses, and mechanotransduction pathways are associated with ${label}?`
    : `Which physiological systems and signaling pathways are associated with ${label} and the adaptation target ${adaptationTarget}?`;

  const mechanismQuestion = isSprintLike
    ? `From ${label}, which genes, proteins, hormones, growth factors, and signaling pathways are implicated, including mTOR-related and neuromuscular signaling?`
    : `From the adaptation target ${adaptationTarget}, which genes, proteins, hormones, and pathways are mechanistically relevant?`;

  const reactionQuestion =
    `For the main pathways and molecules linked to ${label}, which metabolites, cofactors, vitamins, minerals, facilitators, and inhibitors modulate those reactions?`;

  const projectionQuestion =
    `Given the full scientific map for ${label}, what are the implications for training modulation, nutrition/fueling support, recovery, microbiota interactions, and health monitoring?`;

  return [
    hop(
      "hop-literature",
      "intent-stimulus",
      "literature_search",
      stimulusQuestion,
      ["pubmed", "europe_pmc"],
      ["process", "hormone", "phenotype"],
      ["literature", "stimulus_interpretation", trigger.kind],
    ),
    hop(
      "hop-mechanisms",
      "intent-mechanisms",
      "entity_lookup",
      mechanismQuestion,
      ["reactome", "uniprot", "ncbi_gene", "ensembl", "gene_ontology"],
      ["gene", "protein", "pathway", "hormone", "process"],
      ["mechanism_expansion", trigger.kind, trigger.adaptationTarget ?? slug(label)],
    ),
    hop(
      "hop-reactions",
      "intent-reactions",
      "reaction_lookup",
      reactionQuestion,
      ["hmdb", "chebi", "metacyc", "kegg"],
      ["metabolite", "nutrient", "process", "biomarker"],
      ["reaction_expansion", trigger.kind, trigger.adaptationTarget ?? slug(label)],
    ),
    hop(
      "hop-projection",
      "intent-projection",
      "projection_review",
      projectionQuestion,
      ["pubmed", "reactome", "hmdb", "mgnify"],
      ["process", "microbe", "nutrient", "pathway"],
      ["module_projection", trigger.module ?? "cross_module", trigger.adaptationTarget ?? slug(label)],
    ),
  ];
}

export function buildKnowledgeResearchPlan(input: KnowledgeResearchPlanInput): ResearchPlan {
  const trigger = input.trigger;
  const label = triggerLabel(trigger);
  return {
    planId: `research-plan:${slug(label) || "trigger"}`,
    createdAt: new Date().toISOString(),
    status: "ready",
    trigger,
    intents: intentsForTrigger(trigger),
    hops: hopsForTrigger(trigger),
  };
}
