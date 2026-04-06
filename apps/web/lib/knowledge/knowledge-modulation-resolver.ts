import type {
  AthleteKnowledgeBinding,
  KnowledgeModulationSnapshot,
  PhysiologyState,
  TwinState,
} from "@/lib/empathy/schemas";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildSnapshot(input: {
  athleteId: string;
  domain: KnowledgeModulationSnapshot["domain"];
  bindings: AthleteKnowledgeBinding[];
  constraintLevel: KnowledgeModulationSnapshot["constraintLevel"];
  hardConstraints?: string[];
  softConstraints?: string[];
  adaptiveFlags?: string[];
  recommendedSupports?: string[];
  blockedSupports?: string[];
  reasoningSummary: string;
  evidenceLevel?: KnowledgeModulationSnapshot["evidenceLevel"];
}) {
  return {
    snapshotId: `derived:${input.athleteId}:${input.domain}:modulation`,
    athleteId: input.athleteId,
    domain: input.domain,
    computedAt: new Date().toISOString(),
    constraintLevel: input.constraintLevel,
    hardConstraints: unique(input.hardConstraints ?? []),
    softConstraints: unique(input.softConstraints ?? []),
    adaptiveFlags: unique(input.adaptiveFlags ?? []),
    recommendedSupports: unique(input.recommendedSupports ?? []),
    blockedSupports: unique(input.blockedSupports ?? []),
    reasoningSummary: input.reasoningSummary,
    confidence: clamp(average(input.bindings.map((binding) => binding.confidence)), 0, 1),
    evidenceLevel: input.evidenceLevel ?? "exploratory",
    supportingBindings: input.bindings.map((binding) => binding.bindingId),
    evidenceRefs: [],
  } satisfies KnowledgeModulationSnapshot;
}

export function deriveKnowledgeModulationSnapshots(input: {
  athleteId: string;
  bindings: AthleteKnowledgeBinding[];
  physiology: PhysiologyState | null;
  twin: TwinState | null;
}): KnowledgeModulationSnapshot[] {
  const twin = input.twin;
  const physiology = input.physiology;
  if (!twin || !physiology) return [];

  const byTag = new Map<string, AthleteKnowledgeBinding>();
  for (const binding of input.bindings) {
    for (const tag of binding.contextTags) {
      if (!byTag.has(tag)) byTag.set(tag, binding);
    }
  }

  const snapshots: KnowledgeModulationSnapshot[] = [];
  const readinessProtection = byTag.get("readiness_protection_microcycle");
  const oxidativeSupport = byTag.get("oxidative_bottleneck_resolution");
  const gutAbsorption = byTag.get("gut_absorption_progression_protocol");
  const redoxStability = byTag.get("redox_stability_block");
  const ironMonitoring = byTag.get("iron_recovery_monitoring");
  const epigeneticRecovery = byTag.get("epigenetic_recovery_block");

  if (readinessProtection || oxidativeSupport) {
    const bindings = [readinessProtection, oxidativeSupport].filter(Boolean) as AthleteKnowledgeBinding[];
    const readiness = twin.readiness ?? 100;
    const oxidativeBottleneck =
      physiology.performanceProfile.oxidativeBottleneckIndex ?? twin.oxidativeBottleneck ?? 0;
    const protective = readiness < 45;
    snapshots.push(
      buildSnapshot({
        athleteId: input.athleteId,
        domain: "training",
        bindings,
        constraintLevel: protective ? "hard" : "adaptive",
        hardConstraints: protective ? ["avoid_density_escalation_under_low_readiness"] : [],
        softConstraints: oxidativeBottleneck >= 60 ? ["bias_toward_mitochondrial_density_over_glycolytic_repetition"] : [],
        adaptiveFlags: [
          readinessProtection ? "readiness_protection_microcycle" : "",
          oxidativeSupport ? "oxidative_bottleneck_resolution" : "",
        ],
        recommendedSupports: [
          oxidativeSupport ? "prioritize_progressive_oxidative_support" : "",
          readinessProtection ? "favor_load_protection_until_readiness_recovers" : "",
        ],
        blockedSupports: protective ? ["avoid_unbuffered_high_intensity_stacking"] : [],
        reasoningSummary:
          "Training modulation derived from readiness protection and oxidative bottleneck candidate bindings.",
      }),
    );
  }

  if (gutAbsorption) {
    const giTolerance = twin.giTolerance ?? 100;
    snapshots.push(
      buildSnapshot({
        athleteId: input.athleteId,
        domain: "nutrition",
        bindings: [gutAbsorption],
        constraintLevel: giTolerance < 45 ? "hard" : "adaptive",
        hardConstraints: giTolerance < 45 ? ["avoid_aggressive_fueling_density_when_gi_tolerance_is_low"] : [],
        softConstraints: ["progress_carbohydrate_delivery_only_through_tolerated_steps"],
        adaptiveFlags: ["gut_absorption_progression_protocol"],
        recommendedSupports: ["favor_low_stress_absorption_progression", "monitor_cho_delivery_response"],
        blockedSupports: ["avoid_unrehearsed_gut_load_escalation"],
        reasoningSummary:
          "Nutrition modulation derived from gut absorption candidate bindings and current GI tolerance.",
      }),
    );
  }

  if (redoxStability) {
    const redoxStress =
      physiology.performanceProfile.redoxStressIndex ??
      twin.redoxStressIndex ??
      physiology.bioenergeticProfile.inflammationProxy ??
      0;
    snapshots.push(
      buildSnapshot({
        athleteId: input.athleteId,
        domain: "bioenergetics",
        bindings: [redoxStability],
        constraintLevel: redoxStress >= 65 ? "hard" : "adaptive",
        hardConstraints: redoxStress >= 65 ? ["avoid_compounding_redox_stress_when_signal_is_elevated"] : [],
        softConstraints: ["prefer_redox_stability_over_additional_metabolic_noise"],
        adaptiveFlags: ["redox_stability_block"],
        recommendedSupports: ["support_recovery_capacity_before_extra_intensity"],
        blockedSupports: redoxStress >= 65 ? ["avoid_back_to_back_high_oxidative_stress_sessions"] : [],
        reasoningSummary:
          "Bioenergetic modulation derived from redox and inflammation candidate bindings.",
      }),
    );
  }

  if (ironMonitoring) {
    snapshots.push(
      buildSnapshot({
        athleteId: input.athleteId,
        domain: "health",
        bindings: [ironMonitoring],
        constraintLevel: "adaptive",
        softConstraints: ["keep_oxygen_transport_risk_visible_in_planning_reviews"],
        adaptiveFlags: ["iron_recovery_monitoring"],
        recommendedSupports: ["track_blood_marker_follow_up_before_load_escalation"],
        reasoningSummary:
          "Health modulation derived from iron-related monitoring candidate bindings.",
      }),
    );
  }

  if (epigeneticRecovery) {
    snapshots.push(
      buildSnapshot({
        athleteId: input.athleteId,
        domain: "recovery",
        bindings: [epigeneticRecovery],
        constraintLevel: "adaptive",
        softConstraints: ["favor_recovery_support_until_epigenetic_constraints_are_better_characterized"],
        adaptiveFlags: ["epigenetic_recovery_block"],
        recommendedSupports: ["increase_recovery_attention_and_context_tracking"],
        reasoningSummary:
          "Recovery modulation derived from epigenetic candidate bindings.",
      }),
    );
  }

  return snapshots;
}

export function mergeKnowledgeModulations(
  persisted: KnowledgeModulationSnapshot[],
  derived: KnowledgeModulationSnapshot[],
): KnowledgeModulationSnapshot[] {
  const out: KnowledgeModulationSnapshot[] = [];
  const seen = new Set<string>();
  for (const snapshot of [...persisted, ...derived]) {
    const key = `${snapshot.domain}:${snapshot.snapshotId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(snapshot);
  }
  return out;
}
