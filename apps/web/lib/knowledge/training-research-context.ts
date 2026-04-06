import type { ResearchPlan, ResearchPlannerTrigger } from "@/lib/empathy/schemas";
import type { AdaptationTarget } from "@/lib/training/engine";
import { buildKnowledgeResearchPlan } from "@/lib/knowledge/research-planner";

type BuildTrainingSessionResearchPlanInput = {
  athleteId: string;
  sport: string;
  goalLabel: string;
  adaptationTarget: AdaptationTarget;
  intensityHint?: string;
  objectiveDetail?: string;
};

type BuildViryaResearchPlansInput = {
  athleteId: string;
  strategyHints: string[];
  flags: Record<string, boolean>;
};

function compactParts(parts: Array<string | null | undefined>) {
  return parts.map((part) => String(part ?? "").trim()).filter(Boolean);
}

function buildPlan(trigger: ResearchPlannerTrigger): ResearchPlan {
  return buildKnowledgeResearchPlan({ trigger });
}

export function buildTrainingSessionResearchPlan(
  input: BuildTrainingSessionResearchPlanInput,
): ResearchPlan {
  const stimulusLabel = compactParts([
    input.sport,
    input.goalLabel,
    input.intensityHint,
    input.objectiveDetail,
  ]).join(" · ");

  return buildPlan({
    kind: "session_stimulus",
    athleteId: input.athleteId,
    module: "training",
    adaptationTarget: input.adaptationTarget,
    stimulusLabel: stimulusLabel || input.adaptationTarget,
  });
}

function viryaHintToTrigger(
  athleteId: string,
  hint: string,
  flags: Record<string, boolean>,
): ResearchPlannerTrigger {
  switch (hint) {
    case "focus_z2_mitochondrial_density":
      return {
        kind: "adaptation_target",
        athleteId,
        module: "training",
        adaptationTarget: "mitochondrial_density",
        stimulusLabel: "Z2 mitochondrial density support",
      };
    case "lactate_clearance_mct_block":
      return {
        kind: "adaptation_target",
        athleteId,
        module: "training",
        adaptationTarget: "lactate_clearance",
        stimulusLabel: "Lactate clearance / MCT support block",
      };
    case "redox_stability_block":
      return {
        kind: "modulation_followup",
        athleteId,
        module: "health",
        adaptationTarget: "recovery",
        stimulusLabel: "Redox stability and recovery protection",
      };
    case "gut_absorption_progression_protocol":
      return {
        kind: "downstream_projection",
        athleteId,
        module: "nutrition",
        stimulusLabel: "Gut absorption progression and fueling tolerance",
      };
    case "epigenetic_recovery_block":
      return {
        kind: "modulation_followup",
        athleteId,
        module: "health",
        adaptationTarget: "recovery",
        stimulusLabel: "Epigenetic recovery and resilience support",
      };
    case "iron_recovery_monitoring":
      return {
        kind: "downstream_projection",
        athleteId,
        module: "health",
        stimulusLabel: "Iron status, oxygen transport, and recovery monitoring",
      };
    case "oxidative_bottleneck_resolution":
      return {
        kind: "adaptation_target",
        athleteId,
        module: "training",
        adaptationTarget: "mitochondrial_density",
        stimulusLabel: "Oxidative bottleneck resolution",
      };
    case "glycogen_restoration_priority":
      return {
        kind: "downstream_projection",
        athleteId,
        module: "nutrition",
        adaptationTarget: "recovery",
        stimulusLabel: "Glycogen restoration priority",
      };
    case "readiness_protection_microcycle":
      return {
        kind: "adaptation_target",
        athleteId,
        module: "training",
        adaptationTarget: "recovery",
        stimulusLabel: "Readiness protection microcycle",
      };
    default:
      return {
        kind: "adaptation_target",
        athleteId,
        module: flags.redoxLimit || flags.epigeneticConstraint ? "health" : "training",
        adaptationTarget: flags.peripheralLimit ? "mitochondrial_density" : "recovery",
        stimulusLabel: hint.replaceAll("_", " "),
      };
  }
}

export function buildViryaResearchPlans(input: BuildViryaResearchPlansInput): ResearchPlan[] {
  const hints = input.strategyHints.length ? input.strategyHints : ["balanced_periodization"];
  const unique = Array.from(new Set(hints)).slice(0, 3);
  return unique.map((hint) => buildPlan(viryaHintToTrigger(input.athleteId, hint, input.flags)));
}
