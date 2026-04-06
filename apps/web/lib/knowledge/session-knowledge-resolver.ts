import type {
  AthleteKnowledgeBinding,
  AthleteMemory,
  KnowledgeModulationSnapshot,
  SessionKnowledgePacket,
} from "@/lib/empathy/schemas";

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function adaptationIntent(adaptationTarget: string) {
  switch (adaptationTarget) {
    case "mitochondrial_density":
      return ["improve mitochondrial density", "increase oxidative support"];
    case "vo2_max_support":
      return ["support oxygen utilization", "improve aerobic power support"];
    case "lactate_tolerance":
      return ["increase tolerance to glycolytic stress", "buffer high-intensity load"];
    case "lactate_clearance":
      return ["improve lactate clearance", "support oxidative recycling"];
    case "max_strength":
      return ["increase neuromuscular force production"];
    case "power_output":
      return ["improve explosive power output"];
    case "movement_quality":
      return ["improve movement quality and control"];
    case "mobility_capacity":
      return ["improve mobility capacity"];
    case "skill_transfer":
      return ["support technical transfer under load"];
    case "recovery":
      return ["support recovery and regeneration"];
    default:
      return [adaptationTarget.replaceAll("_", " ")];
  }
}

function selectPrimaryModulation(modulations: KnowledgeModulationSnapshot[]) {
  return (
    modulations.find((snapshot) => snapshot.domain === "training") ??
    modulations.find((snapshot) => snapshot.domain === "bioenergetics") ??
    modulations.find((snapshot) => snapshot.domain === "nutrition") ??
    modulations[0] ??
    null
  );
}

function resolveSupportingBindings(
  allBindings: AthleteKnowledgeBinding[],
  modulation: KnowledgeModulationSnapshot | null,
) {
  if (!modulation) return [];
  const byId = new Map(allBindings.map((binding) => [binding.bindingId, binding]));
  return modulation.supportingBindings
    .map((bindingId) => byId.get(bindingId) ?? null)
    .filter((binding): binding is AthleteKnowledgeBinding => binding != null);
}

export function buildSessionKnowledgePacket(input: {
  athleteId: string;
  adaptationTarget: string;
  athleteMemory: AthleteMemory;
}): SessionKnowledgePacket | null {
  const knowledge = input.athleteMemory.knowledge;
  if (!knowledge) return null;

  const primaryModulation = selectPrimaryModulation(knowledge.activeModulations);
  const supportingBindings = resolveSupportingBindings(knowledge.bindings, primaryModulation);
  const allModulations = knowledge.activeModulations;
  const nutritionSupports = unique(
    allModulations
      .filter((snapshot) => snapshot.domain === "nutrition" || snapshot.domain === "bioenergetics")
      .flatMap((snapshot) => snapshot.recommendedSupports),
  );
  const inhibitorsAndRisks = unique(
    allModulations.flatMap((snapshot) => [
      ...snapshot.hardConstraints,
      ...snapshot.softConstraints,
      ...snapshot.blockedSupports,
    ]),
  );
  const primaryMechanisms = unique([
    ...supportingBindings.flatMap((binding) => binding.contextTags),
    ...(primaryModulation?.adaptiveFlags ?? []),
  ]);
  const evidenceRefs = unique([
    ...(primaryModulation?.evidenceRefs.map((ref) => `${ref.sourceDb}:${ref.externalId}`) ?? []),
  ]);

  return {
    packetId: `derived:${input.athleteId}:${input.adaptationTarget}:session-knowledge`,
    athleteId: input.athleteId,
    adaptationTarget: input.adaptationTarget,
    physiologicalIntent: adaptationIntent(input.adaptationTarget),
    primaryMechanisms,
    relevantPathways: [],
    relevantGenes: [],
    relevantProteins: [],
    relevantMetabolites: [],
    relevantMicrobiota: [],
    nutritionSupports,
    inhibitorsAndRisks,
    modulation: primaryModulation,
    evidenceRefs:
      primaryModulation?.evidenceRefs.filter((ref) => evidenceRefs.includes(`${ref.sourceDb}:${ref.externalId}`)) ?? [],
    confidence: primaryModulation?.confidence ?? 0,
    evidenceLevel: primaryModulation?.evidenceLevel ?? "exploratory",
    reasoningPolicy: {
      canExplain: true,
      canModulate: true,
      cannotOverrideDeterministicEngine: true,
    },
  };
}
