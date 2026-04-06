import type {
  AthleteHealthMemory,
  AthleteKnowledgeBinding,
  PhysiologyState,
  TwinState,
} from "@/lib/empathy/schemas";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildCandidateBinding(input: {
  athleteId: string;
  key: string;
  domain: AthleteKnowledgeBinding["domain"];
  contextTags: string[];
  physiologySignals?: string[];
  twinSignals?: string[];
  healthSignals?: string[];
  nutritionSignals?: string[];
  confidence: number;
}): AthleteKnowledgeBinding {
  return {
    bindingId: `derived:${input.athleteId}:${input.key}`,
    athleteId: input.athleteId,
    domain: input.domain,
    status: "candidate",
    triggeredBy: {
      physiologySignals: input.physiologySignals ?? [],
      twinSignals: input.twinSignals ?? [],
      healthSignals: input.healthSignals ?? [],
      nutritionSignals: input.nutritionSignals ?? [],
    },
    contextTags: input.contextTags,
    mechanismAssertions: [],
    evidenceLevel: "exploratory",
    confidence: input.confidence,
    validFrom: todayIsoDate(),
  };
}

export function deriveCandidateKnowledgeBindings(input: {
  athleteId: string;
  physiology: PhysiologyState | null;
  twin: TwinState | null;
  health: AthleteHealthMemory;
}): AthleteKnowledgeBinding[] {
  const physiology = input.physiology;
  const twin = input.twin;
  if (!physiology || !twin) return [];

  const candidates: AthleteKnowledgeBinding[] = [];
  const latestLactate = physiology.lactateProfile.latestValues ?? {};
  const latestMaxOx = physiology.performanceProfile.latestValues ?? {};
  const latestGenomics = input.health.epigenetics ?? null;
  const latestBlood = input.health.blood ?? null;

  const peripheralLimit = (asNumber(latestMaxOx.peripheralUtilizationIndex) ?? 1) < 0.8;
  const redoxLimit =
    (asNumber(latestMaxOx.redoxStressIndex) ?? 0) >= 55 ||
    (physiology.bioenergeticProfile.inflammationProxy ?? 0) >= 55;
  const gutConstraint =
    (asNumber(latestLactate.effectiveSequestrationPct) ?? 0) >= 12 ||
    (physiology.bioenergeticProfile.hydrationStatus ?? 100) < 45;
  const dysbiosisRisk = (asNumber(latestLactate.microbiotaDysbiosisScore) ?? 0) >= 0.35;
  const epigeneticConstraint =
    (asNumber(latestGenomics?.mthfr_risk_score_0_10) ?? 0) >= 7 ||
    (asNumber(latestGenomics?.nrf2_pathway_score_0_10) ?? 10) <= 4;
  const ironConstraint = (asNumber(latestBlood?.ferritin_ng_ml) ?? 80) < 35;

  if (peripheralLimit || (physiology.performanceProfile.oxidativeBottleneckIndex ?? 0) >= 60) {
    candidates.push(
      buildCandidateBinding({
        athleteId: input.athleteId,
        key: "oxidative_bottleneck_resolution",
        domain: "training",
        contextTags: ["oxidative_bottleneck_resolution", "mitochondrial_support"],
        physiologySignals: ["oxidativeBottleneckIndex", "peripheralUtilizationIndex"],
        twinSignals: ["oxidativeBottleneck"],
        confidence: 0.68,
      }),
    );
  }

  if (gutConstraint || dysbiosisRisk) {
    candidates.push(
      buildCandidateBinding({
        athleteId: input.athleteId,
        key: "gut_absorption_progression_protocol",
        domain: "nutrition",
        contextTags: ["gut_absorption_progression_protocol", "cho_delivery"],
        physiologySignals: ["effectiveSequestrationPct", "microbiotaDysbiosisScore"],
        twinSignals: ["giTolerance"],
        healthSignals: input.health.microbiota ? ["microbiota_panel"] : [],
        nutritionSignals: ["fuel_delivery_constraint"],
        confidence: 0.72,
      }),
    );
  }

  if (redoxLimit) {
    candidates.push(
      buildCandidateBinding({
        athleteId: input.athleteId,
        key: "redox_stability_block",
        domain: "bioenergetics",
        contextTags: ["redox_stability_block", "oxidative_stress_control"],
        physiologySignals: ["redoxStressIndex", "inflammationProxy"],
        twinSignals: ["redoxStressIndex", "inflammationRisk"],
        confidence: 0.7,
      }),
    );
  }

  if ((twin.readiness ?? 100) < 45) {
    candidates.push(
      buildCandidateBinding({
        athleteId: input.athleteId,
        key: "readiness_protection_microcycle",
        domain: "training",
        contextTags: ["readiness_protection_microcycle", "load_protection"],
        twinSignals: ["readiness", "recoveryDebt", "adaptationReadiness"],
        confidence: 0.74,
      }),
    );
  }

  if (ironConstraint) {
    candidates.push(
      buildCandidateBinding({
        athleteId: input.athleteId,
        key: "iron_recovery_monitoring",
        domain: "health",
        contextTags: ["iron_recovery_monitoring", "oxygen_transport"],
        healthSignals: ["ferritin_ng_ml"],
        physiologySignals: ["vo2maxMlMinKg"],
        confidence: 0.69,
      }),
    );
  }

  if (epigeneticConstraint) {
    candidates.push(
      buildCandidateBinding({
        athleteId: input.athleteId,
        key: "epigenetic_recovery_block",
        domain: "recovery",
        contextTags: ["epigenetic_recovery_block", "nrf2_methylation"],
        healthSignals: ["mthfr_risk_score_0_10", "nrf2_pathway_score_0_10"],
        confidence: 0.63,
      }),
    );
  }

  return candidates;
}

export function mergeKnowledgeBindings(
  persisted: AthleteKnowledgeBinding[],
  derived: AthleteKnowledgeBinding[],
): AthleteKnowledgeBinding[] {
  const out: AthleteKnowledgeBinding[] = [];
  const seen = new Set<string>();
  for (const binding of [...persisted, ...derived]) {
    const key = binding.status === "candidate"
      ? `${binding.status}:${binding.contextTags.join("|")}:${binding.domain}`
      : binding.bindingId;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(binding);
  }
  return out;
}
