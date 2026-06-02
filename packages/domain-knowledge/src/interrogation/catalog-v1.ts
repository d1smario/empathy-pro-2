import type {
  EmpathyInterrogationLevelId,
  EmpathyInterrogationQuestionDef,
} from "@empathy/contracts";

export const INTERROGATION_LEVEL_LABELS_IT: Record<EmpathyInterrogationLevelId, string> = {
  L1_stimulus: "Stimolo biologico (training)",
  L2_energy_systems: "Sistemi energetici",
  L3_molecular_pathways: "Vie molecolari",
  L4_neuroendocrine: "Asse neuroendocrino",
  L5_microbiota: "Microbiota",
  L6_environment: "Ambiente",
  L7_bioenergetics: "Bioenergetica",
  L8_gene_networks: "Network genici",
  L9_interrogation: "Interrogazione canonica",
  L10_decision: "Motore decisionale",
};

/** Le 14 domande L9 — catalogo fisso EMPATHY. */
export const CANONICAL_INTERROGATION_QUESTIONS: EmpathyInterrogationQuestionDef[] = [
  {
    id: "q01_training",
    levelId: "L9_interrogation",
    sectorId: "training",
    promptIt: "Che allenamento sta svolgendo?",
    rationaleIt: "Stimolo contrattile e adattativo del giorno.",
    probeKey: "training.planned_session",
    priority: 1,
  },
  {
    id: "q02_energy_systems",
    levelId: "L9_interrogation",
    sectorId: "energy_systems",
    promptIt: "Quali sistemi energetici usa?",
    rationaleIt: "Aerobico, glicolitico, fosfageno.",
    probeKey: "energy.systems_from_stimulus",
    priority: 2,
  },
  {
    id: "q03_pathways",
    levelId: "L9_interrogation",
    sectorId: "molecular_pathways",
    promptIt: "Quali pathway attiva?",
    rationaleIt: "AMPK, HIF, mTOR, redox, ecc.",
    probeKey: "pathway.modulation",
    priority: 3,
  },
  {
    id: "q04_hormones",
    levelId: "L9_interrogation",
    sectorId: "neuroendocrine",
    promptIt: "Quali ormoni coinvolge?",
    rationaleIt: "Assi simpatico, HPA, tiroide, gonadico.",
    probeKey: "neuroendocrine.axis",
    priority: 4,
  },
  {
    id: "q05_neurotransmitters",
    levelId: "L9_interrogation",
    sectorId: "microbiota",
    promptIt: "Quali neurotrasmettitori (asse gut-brain) sono rilevanti?",
    rationaleIt: "Microbiota e assorbimento modulano segnali centrali.",
    probeKey: "microbiota.neurotransmitters",
    priority: 5,
  },
  {
    id: "q06_gene_networks",
    levelId: "L9_interrogation",
    sectorId: "gene_networks",
    promptIt: "Quali geni/network attiva?",
    rationaleIt: "Mitochondrial, hypertrophy, hypoxia, inflammation.",
    probeKey: "genomics.multiscale",
    priority: 6,
  },
  {
    id: "q07_substrates",
    levelId: "L9_interrogation",
    sectorId: "energy_systems",
    promptIt: "Quali substrati consuma?",
    rationaleIt: "CHO, grassi, aminoacidi in funzione dello stimolo.",
    probeKey: "substrates.demand",
    priority: 7,
  },
  {
    id: "q08_cofactors",
    levelId: "L9_interrogation",
    sectorId: "molecular_pathways",
    promptIt: "Quali cofattori richiede?",
    rationaleIt: "Vitamine, minerali, enzimi limitanti.",
    probeKey: "cofactors.pathway",
    priority: 8,
  },
  {
    id: "q09_micronutrients",
    levelId: "L9_interrogation",
    sectorId: "nutrition_levers",
    promptIt: "Quali micronutrienti servono?",
    rationaleIt: "Target USDA / lab quando cablati.",
    probeKey: "micronutrients.targets",
    priority: 9,
  },
  {
    id: "q10_microbiota_bacteria",
    levelId: "L9_interrogation",
    sectorId: "microbiota",
    promptIt: "Quali batteri/funzioni microbiota supportano il processo?",
    rationaleIt: "SCFA, vitamine, barriera — se panel disponibile.",
    probeKey: "microbiota.panel",
    priority: 10,
  },
  {
    id: "q11_environment",
    levelId: "L9_interrogation",
    sectorId: "environment",
    promptIt: "Quali condizioni ambientali influenzano il processo?",
    rationaleIt: "Caldo, freddo, quota, sonno.",
    probeKey: "environment.context",
    priority: 11,
  },
  {
    id: "q12_biomarkers",
    levelId: "L9_interrogation",
    sectorId: "biomarkers",
    promptIt: "Quali biomarker misurano il processo?",
    rationaleIt: "Panel Health / wearables quando presenti.",
    probeKey: "health.lab",
    priority: 12,
  },
  {
    id: "q13_deficits",
    levelId: "L9_interrogation",
    sectorId: "gaps",
    promptIt: "Quali deficit esistono?",
    rationaleIt: "Gap cofattori vs ematici.",
    probeKey: "gaps.analysis",
    priority: 13,
  },
  {
    id: "q14_levers",
    levelId: "L9_interrogation",
    sectorId: "nutrition_levers",
    promptIt: "Quali leve può attivare EMPATHY?",
    rationaleIt: "Nutrition, fueling, recovery, training, dashboard.",
    probeKey: "decision.levers",
    priority: 14,
  },
];

export type ProductStimulusId =
  | "z1_recovery"
  | "z2_aerobic"
  | "z3_tempo"
  | "z4_threshold"
  | "z5_vo2max"
  | "sprint"
  | "max_strength"
  | "hypertrophy"
  | "plyometric"
  | "hiit"
  | "technique"
  | "skill"
  | "general_endurance";

export type StimulusProfile = {
  id: ProductStimulusId;
  labelIt: string;
  energySystems: string[];
  pathwayTags: string[];
  geneNetworkTags: string[];
};

export const STIMULUS_PROFILES: StimulusProfile[] = [
  {
    id: "z1_recovery",
    labelIt: "Z1 Recovery",
    energySystems: ["aerobic_oxidative"],
    pathwayTags: ["mitochondrial_biogenesis", "parasympathetic_recovery"],
    geneNetworkTags: ["mitochondrial_network"],
  },
  {
    id: "z2_aerobic",
    labelIt: "Z2 Aerobico",
    energySystems: ["aerobic_oxidative"],
    pathwayTags: ["AMPK", "PGC1a", "fat_oxidation"],
    geneNetworkTags: ["mitochondrial_network"],
  },
  {
    id: "z3_tempo",
    labelIt: "Z3 Tempo",
    energySystems: ["aerobic_oxidative", "glycolytic"],
    pathwayTags: ["AMPK", "lactate_signaling"],
    geneNetworkTags: ["mitochondrial_network"],
  },
  {
    id: "z4_threshold",
    labelIt: "Z4 Threshold",
    energySystems: ["glycolytic", "aerobic_oxidative"],
    pathwayTags: ["lactate_buffering", "AMPK"],
    geneNetworkTags: ["mitochondrial_network"],
  },
  {
    id: "z5_vo2max",
    labelIt: "Z5 VO2max",
    energySystems: ["glycolytic", "aerobic_oxidative"],
    pathwayTags: ["HIF", "VEGF", "hypoxia"],
    geneNetworkTags: ["hypoxia_network"],
  },
  {
    id: "sprint",
    labelIt: "Sprint",
    energySystems: ["phosphagen", "glycolytic"],
    pathwayTags: ["mTOR", "catecholamines"],
    geneNetworkTags: ["hypertrophy_network"],
  },
  {
    id: "max_strength",
    labelIt: "Forza massimale",
    energySystems: ["phosphagen", "neuromuscular"],
    pathwayTags: ["mTOR", "IGF1"],
    geneNetworkTags: ["hypertrophy_network"],
  },
  {
    id: "hypertrophy",
    labelIt: "Ipertrofia",
    energySystems: ["glycolytic", "phosphagen"],
    pathwayTags: ["mTOR", "AKT"],
    geneNetworkTags: ["hypertrophy_network"],
  },
  {
    id: "plyometric",
    labelIt: "Plyometric",
    energySystems: ["phosphagen", "neuromuscular"],
    pathwayTags: ["MAPK", "catecholamines"],
    geneNetworkTags: ["hypertrophy_network"],
  },
  {
    id: "hiit",
    labelIt: "HIIT",
    energySystems: ["glycolytic", "aerobic_oxidative"],
    pathwayTags: ["AMPK", "lactate_signaling"],
    geneNetworkTags: ["mitochondrial_network", "inflammation_network"],
  },
  {
    id: "technique",
    labelIt: "Tecnica",
    energySystems: ["neuromuscular"],
    pathwayTags: ["motor_learning"],
    geneNetworkTags: [],
  },
  {
    id: "skill",
    labelIt: "Skill",
    energySystems: ["neuromuscular"],
    pathwayTags: ["motor_learning"],
    geneNetworkTags: [],
  },
  {
    id: "general_endurance",
    labelIt: "Endurance generico",
    energySystems: ["aerobic_oxidative"],
    pathwayTags: ["glycogen_resynthesis"],
    geneNetworkTags: ["mitochondrial_network"],
  },
];

const ADAPTATION_TO_STIMULUS: Record<string, ProductStimulusId> = {
  mitochondrial_density: "z2_aerobic",
  vo2_max_support: "z5_vo2max",
  lactate_tolerance: "z4_threshold",
  lactate_clearance: "z3_tempo",
  max_strength: "max_strength",
  power_output: "sprint",
  hypertrophy_mixed: "hypertrophy",
  hypertrophy_myofibrillar: "hypertrophy",
  hypertrophy_sarcoplasmic: "hypertrophy",
  neuromuscular_adaptation: "plyometric",
  movement_quality: "technique",
  mobility_capacity: "technique",
  skill_transfer: "skill",
};

export function resolveStimulusProfileFromAdaptationTarget(
  adaptationTarget: string | null | undefined,
): StimulusProfile {
  const key = String(adaptationTarget ?? "").trim();
  const id = ADAPTATION_TO_STIMULUS[key] ?? "general_endurance";
  return STIMULUS_PROFILES.find((s) => s.id === id) ?? STIMULUS_PROFILES[STIMULUS_PROFILES.length - 1]!;
}
