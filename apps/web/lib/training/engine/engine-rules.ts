import type {
  AdaptationTarget,
  AthleteMetabolicState,
  LoadBand,
  PrimaryPhysiologySystem,
  SessionGoalRequest,
  SessionMethod,
} from "@/lib/training/engine/types";

type TargetRule = {
  targetSystem: PrimaryPhysiologySystem;
  defaultMethod: SessionMethod;
  intensityCue: string;
  phaseDistribution: Record<SessionGoalRequest["phase"], number[]>;
  baseLoadBand: LoadBand;
};

export const ADAPTATION_RULES: Record<AdaptationTarget, TargetRule> = {
  mitochondrial_density: {
    targetSystem: "aerobic",
    defaultMethod: "steady",
    intensityCue: "Z2 / low lactate / nasal-breath dominated",
    phaseDistribution: {
      base: [0.2, 0.55, 0.15, 0.1],
      build: [0.18, 0.48, 0.22, 0.12],
      peak: [0.2, 0.4, 0.25, 0.15],
      taper: [0.22, 0.35, 0.2, 0.23],
    },
    baseLoadBand: "moderate",
  },
  vo2_max_support: {
    targetSystem: "aerobic",
    defaultMethod: "interval",
    intensityCue: "Z5-focused repeats, high oxygen uptake windows",
    phaseDistribution: {
      base: [0.2, 0.35, 0.3, 0.15],
      build: [0.18, 0.3, 0.37, 0.15],
      peak: [0.2, 0.26, 0.39, 0.15],
      taper: [0.25, 0.28, 0.27, 0.2],
    },
    baseLoadBand: "high",
  },
  lactate_tolerance: {
    targetSystem: "anaerobic_lactic",
    defaultMethod: "interval",
    intensityCue: "High-intensity bouts 30s-4min with constrained recovery",
    phaseDistribution: {
      base: [0.2, 0.3, 0.35, 0.15],
      build: [0.18, 0.25, 0.42, 0.15],
      peak: [0.2, 0.22, 0.43, 0.15],
      taper: [0.24, 0.25, 0.3, 0.21],
    },
    baseLoadBand: "very_high",
  },
  lactate_clearance: {
    targetSystem: "aerobic",
    defaultMethod: "mixed_circuit",
    intensityCue: "Alternating high-low intensity to improve shuttling",
    phaseDistribution: {
      base: [0.18, 0.45, 0.25, 0.12],
      build: [0.15, 0.4, 0.3, 0.15],
      peak: [0.18, 0.35, 0.32, 0.15],
      taper: [0.22, 0.33, 0.25, 0.2],
    },
    baseLoadBand: "high",
  },
  max_strength: {
    targetSystem: "neuromuscular_strength",
    defaultMethod: "strength_sets",
    intensityCue: "Alta tensione meccanica: basse ripetute, recuperi lunghi, tecnica prioritaria (proxy %1RM alto)",
    phaseDistribution: {
      base: [0.18, 0.2, 0.45, 0.17],
      build: [0.15, 0.2, 0.48, 0.17],
      peak: [0.15, 0.18, 0.5, 0.17],
      taper: [0.2, 0.2, 0.35, 0.25],
    },
    baseLoadBand: "high",
  },
  hypertrophy_mixed: {
    targetSystem: "neuromuscular_strength",
    defaultMethod: "strength_sets",
    intensityCue:
      "Ipertrofia bilanciata (V1 massa): volume moderato-alto, ROM completo, vicinanza a cedimento gestita su ultime serie",
    phaseDistribution: {
      base: [0.16, 0.22, 0.46, 0.16],
      build: [0.14, 0.2, 0.5, 0.16],
      peak: [0.14, 0.18, 0.52, 0.16],
      taper: [0.18, 0.2, 0.4, 0.22],
    },
    baseLoadBand: "high",
  },
  hypertrophy_myofibrillar: {
    targetSystem: "neuromuscular_strength",
    defaultMethod: "strength_sets",
    intensityCue:
      "EMPATHY fibrillare: alta intensità relativa, volume complessivo contenuto (poche serie pesanti di qualità). Sport di potenza e profili misti aerobico/anaerobico: più forza senza ipertrofia volumetrica eccessiva.",
    phaseDistribution: {
      /** Più warm/cool e meno “torta” main+secondary vs sarcoplasmica: sessione meno densa di lavoro accessorio. */
      base: [0.21, 0.17, 0.43, 0.19],
      build: [0.19, 0.15, 0.45, 0.21],
      peak: [0.18, 0.14, 0.46, 0.22],
      taper: [0.22, 0.14, 0.38, 0.26],
    },
    baseLoadBand: "high",
  },
  hypertrophy_sarcoplasmic: {
    targetSystem: "neuromuscular_strength",
    defaultMethod: "strength_sets",
    intensityCue:
      "EMPATHY sarcoplasmica: alto volume, sfinimento, alta densità metabolica; meno focus sul rapporto peso/potenza da atleta misto. Bodybuilding, pesistica, sport di forza in atletica: massa e capacità di volume come obiettivo.",
    phaseDistribution: {
      /** Quota main+secondary più alta: più minuti nel lavoro gravoso + accessorio voluminoso. */
      base: [0.13, 0.22, 0.5, 0.15],
      build: [0.11, 0.2, 0.54, 0.15],
      peak: [0.1, 0.18, 0.58, 0.14],
      taper: [0.14, 0.16, 0.48, 0.22],
    },
    baseLoadBand: "very_high",
  },
  neuromuscular_adaptation: {
    targetSystem: "neuromuscular_power",
    defaultMethod: "power_sets",
    intensityCue:
      "Adattamento neuromuscolare (V1 neuromuscolare): carico submassimale, intento velocità, qualità ripetizione, recupero per RFD",
    phaseDistribution: {
      base: [0.18, 0.22, 0.43, 0.17],
      build: [0.16, 0.22, 0.45, 0.17],
      peak: [0.15, 0.2, 0.48, 0.17],
      taper: [0.2, 0.2, 0.38, 0.22],
    },
    baseLoadBand: "moderate",
  },
  power_output: {
    targetSystem: "neuromuscular_power",
    defaultMethod: "power_sets",
    intensityCue: "Explosive intent, low fatigue density, maximal quality",
    phaseDistribution: {
      base: [0.2, 0.2, 0.42, 0.18],
      build: [0.18, 0.2, 0.45, 0.17],
      peak: [0.18, 0.15, 0.5, 0.17],
      taper: [0.2, 0.18, 0.38, 0.24],
    },
    baseLoadBand: "high",
  },
  movement_quality: {
    targetSystem: "coordination",
    defaultMethod: "technical_drill",
    intensityCue: "High technical quality under moderate fatigue",
    phaseDistribution: {
      base: [0.18, 0.3, 0.32, 0.2],
      build: [0.15, 0.28, 0.37, 0.2],
      peak: [0.15, 0.25, 0.4, 0.2],
      taper: [0.2, 0.22, 0.3, 0.28],
    },
    baseLoadBand: "moderate",
  },
  mobility_capacity: {
    targetSystem: "mobility",
    defaultMethod: "flow_recovery",
    intensityCue: "Controlled range, breath-paced tempo",
    phaseDistribution: {
      base: [0.12, 0.28, 0.25, 0.35],
      build: [0.12, 0.24, 0.28, 0.36],
      peak: [0.12, 0.22, 0.3, 0.36],
      taper: [0.15, 0.2, 0.25, 0.4],
    },
    baseLoadBand: "low",
  },
  skill_transfer: {
    targetSystem: "skill",
    defaultMethod: "technical_drill",
    intensityCue: "Sport-specific constraints, tactical context first",
    phaseDistribution: {
      base: [0.15, 0.25, 0.35, 0.25],
      build: [0.12, 0.25, 0.4, 0.23],
      peak: [0.1, 0.2, 0.45, 0.25],
      taper: [0.14, 0.18, 0.33, 0.35],
    },
    baseLoadBand: "moderate",
  },
  recovery: {
    targetSystem: "aerobic",
    defaultMethod: "flow_recovery",
    intensityCue: "Low stress, autonomic down-regulation, tissue reset",
    phaseDistribution: {
      base: [0.1, 0.25, 0.15, 0.5],
      build: [0.1, 0.2, 0.2, 0.5],
      peak: [0.1, 0.18, 0.2, 0.52],
      taper: [0.12, 0.16, 0.16, 0.56],
    },
    baseLoadBand: "low",
  },
};

function loadBandToScore(load: LoadBand): number {
  if (load === "low") return 1;
  if (load === "moderate") return 2;
  if (load === "high") return 3;
  return 4;
}

function scoreToLoadBand(score: number): LoadBand {
  if (score <= 1.5) return "low";
  if (score <= 2.5) return "moderate";
  if (score <= 3.5) return "high";
  return "very_high";
}

export function deriveLoadBand(ruleLoadBand: LoadBand, athlete: AthleteMetabolicState): LoadBand {
  const baseScore = loadBandToScore(ruleLoadBand);
  const readinessPenalty = athlete.readinessScore < 40 ? -1 : athlete.readinessScore < 55 ? -0.5 : 0;
  const fatiguePenalty = athlete.fatigueScore > 75 ? -1 : athlete.fatigueScore > 60 ? -0.5 : 0;
  const finalScore = Math.max(1, Math.min(4, baseScore + readinessPenalty + fatiguePenalty));
  return scoreToLoadBand(finalScore);
}
