import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type { NutritionMetabolicEfficiencyGenerativeViewModel } from "@/api/nutrition/contracts";
import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";
import type { BioenergeticModulation } from "@/lib/training/bioenergetic-modulation";
import type { AdaptationRegenerationLoop } from "@/lib/training/adaptation-regeneration-loop";

type LoopLike = Pick<
  AdaptationRegenerationLoop,
  "status" | "nextAction" | "adaptationScore" | "guidance"
> | null;

function bandFromScore(score: number | null | undefined): NutritionMetabolicEfficiencyGenerativeViewModel["bands"]["mitochondrialSupport"] {
  if (score == null || !Number.isFinite(score)) return "moderate";
  if (score < 45) return "low";
  if (score < 68) return "moderate";
  return "high";
}

function adaptiveBand(
  guidance: AdaptationGuidance,
  loop: LoopLike,
): NutritionMetabolicEfficiencyGenerativeViewModel["bands"]["adaptiveAlignment"] {
  if (guidance.trafficLight === "red" || loop?.status === "regenerate") return "low";
  if (guidance.trafficLight === "yellow" || loop?.status === "watch") return "moderate";
  return "high";
}

function substrateBand(bio: BioenergeticModulation | null): NutritionMetabolicEfficiencyGenerativeViewModel["bands"]["substrateAvailability"] {
  if (!bio?.fuelAvailabilityScore) return "moderate";
  return bandFromScore(bio.fuelAvailabilityScore);
}

function efficiencyIndex(input: {
  bio: BioenergeticModulation | null;
  guidance: AdaptationGuidance;
  loop: LoopLike;
  traceBoost: number;
}): number {
  const mito = input.bio?.mitochondrialReadinessScore ?? 58;
  const adapt = input.guidance.scorePct;
  const loopScore = input.loop?.adaptationScore ?? adapt;
  const raw = mito * 0.42 + adapt * 0.33 + loopScore * 0.25 + input.traceBoost;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function traceAmplification(traces: KnowledgeResearchTraceSummary[]): string | null {
  const parts = traces
    .filter((t) => (t.latestResultSummary ?? "").trim().length > 0)
    .slice(0, 2)
    .map((t) => t.latestResultSummary!.trim());
  if (!parts.length) return null;
  return `Contesto evidenza attivo: ${parts.join(" · ")}`;
}

function buildLevers(input: {
  bio: BioenergeticModulation | null;
  guidance: AdaptationGuidance;
  loop: LoopLike;
}): NutritionMetabolicEfficiencyGenerativeViewModel["levers"] {
  const levers: NutritionMetabolicEfficiencyGenerativeViewModel["levers"] = [];

  if (input.bio?.state === "protective" || (input.bio?.mitochondrialReadinessScore ?? 70) < 48) {
    levers.push({
      domain: "nutrition",
      priority: 1,
      title: "Timing energetico e densità glucidica",
      detail:
        "Privilegia CHO peri-workout e riduci il digiuno prolungato in giornata quando la modulazione bioenergetica è protettiva: sostiene glicogeno e tolleranza al carico senza aumentare il volume di allenamento.",
    });
    levers.push({
      domain: "recovery",
      priority: 2,
      title: "Recupero autonomico",
      detail:
        "Allinea sonno, HRV e idratazione: il modello segnala riserva mitocondriale o idratazione cellulare non ottimali; il recupero amplifica l’efficienza metabolica più dell’intensità aggiuntiva.",
    });
  }

  if (input.guidance.trafficLight !== "green" || input.loop?.status === "watch" || input.loop?.status === "regenerate") {
    levers.push({
      domain: "training",
      priority: levers.length ? 2 : 1,
      title: "Allineamento carico ↔ adattamento osservato",
      detail:
        input.loop?.guidance?.trim() ||
        input.guidance.guidance ||
        "Ricalibra il microciclo: l’adattamento osservato non è in linea con l’atteso; mantieni qualità seduta e coerenza nutrizionale prima di spingere il volume.",
    });
  }

  if (!levers.length) {
    levers.push({
      domain: "nutrition",
      priority: 1,
      title: "Mantenimento efficienza substrati",
      detail:
        "Copertura proteica stabile, CHO proporzionati al carico pianificato e idratazione costante: i proxy bioenergetici supportano una giornata metabolica standard.",
    });
    levers.push({
      domain: "training",
      priority: 2,
      title: "Progressione controllata",
      detail:
        "Con semaforo verde e loop allineato, privilegia qualità e progressione graduale; il twin e la fisiologia restano la fonte del carico, non la UI.",
    });
  }

  levers.sort((a, b) => a.priority - b.priority);
  return levers.slice(0, 5);
}

function buildNarrative(input: {
  bio: BioenergeticModulation | null;
  guidance: AdaptationGuidance;
  loop: LoopLike;
  index: number;
  knowledgeLine: string | null;
}): string {
  const chunks: string[] = [];
  chunks.push(
    `Indice sintetico di efficienza metabolica (interpretazione): ${input.index}/100 — combina readiness bioenergetica, adattamento atteso/osservato e stato del loop allenamento.`,
  );
  if (input.bio) {
    chunks.push(input.bio.guidance);
  } else {
    chunks.push(
      "Profilo bioenergetico non calcolabile: mancano twin/fisiologia minimi; il modulo nutrizionale resta su euristiche di piano finché lo stato canonico non è disponibile.",
    );
  }
  chunks.push(input.guidance.guidance);
  if (input.loop?.guidance) {
    chunks.push(`Loop adattazione: ${input.loop.guidance}`);
  }
  if (input.knowledgeLine) {
    chunks.push(input.knowledgeLine);
  }
  return chunks.join(" ");
}

/**
 * Generative **interpretation** layer: fuses deterministic engine outputs (bioenergetics,
 * adaptation guidance, training loop) and optional research trace summaries into a single
 * nutrition-facing model. Does not compute physiology; does not replace Builder or engines.
 */
export function buildMetabolicEfficiencyGenerativeModel(input: {
  adaptationGuidance: AdaptationGuidance;
  bioenergeticModulation: BioenergeticModulation | null;
  adaptationLoop: LoopLike;
  researchTraceSummaries: KnowledgeResearchTraceSummary[];
}): NutritionMetabolicEfficiencyGenerativeViewModel {
  const { adaptationGuidance, bioenergeticModulation, adaptationLoop, researchTraceSummaries } = input;

  const linkedTraces = researchTraceSummaries.filter((t) => t.linkCounts.documents > 0 || t.linkCounts.assertions > 0);
  const traceBoost = linkedTraces.length ? Math.min(6, linkedTraces.length * 3) : 0;
  const knowledgeAmplification = traceAmplification(researchTraceSummaries);

  const bands = {
    substrateAvailability: substrateBand(bioenergeticModulation),
    mitochondrialSupport: bandFromScore(bioenergeticModulation?.mitochondrialReadinessScore),
    adaptiveAlignment: adaptiveBand(adaptationGuidance, adaptationLoop),
  };

  const metabolicEfficiencyIndex = efficiencyIndex({
    bio: bioenergeticModulation,
    guidance: adaptationGuidance,
    loop: adaptationLoop,
    traceBoost,
  });

  const levers = buildLevers({
    bio: bioenergeticModulation,
    guidance: adaptationGuidance,
    loop: adaptationLoop,
  });

  const headline =
    bands.adaptiveAlignment === "low" || bands.mitochondrialSupport === "low"
      ? "Modellazione metabolica: priorità a recupero e allineamento carico"
      : bands.mitochondrialSupport === "high" && bands.adaptiveAlignment === "high"
        ? "Modellazione metabolica: efficienza e adattamento coerenti"
        : "Modellazione metabolica: ottimizzazione controllata substrati e seduta";

  const narrative = buildNarrative({
    bio: bioenergeticModulation,
    guidance: adaptationGuidance,
    loop: adaptationLoop,
    index: metabolicEfficiencyIndex,
    knowledgeLine: knowledgeAmplification,
  });

  const inputsUsed = [
    "adaptation_guidance",
    bioenergeticModulation ? "bioenergetic_modulation" : null,
    adaptationLoop ? "adaptation_regeneration_loop" : null,
    researchTraceSummaries.length ? "research_trace_summaries" : null,
  ].filter((x): x is string => Boolean(x));

  return {
    modelVersion: 1,
    layer: "interpretation",
    headline,
    narrative,
    metabolicEfficiencyIndex,
    bands,
    levers,
    knowledgeAmplification,
    inputsUsed,
  };
}
