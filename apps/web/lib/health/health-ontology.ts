import "server-only";

import type { HealthPanelTypeForParse } from "@/lib/health/lab-text-extractors";

export type HealthMarkerDefinition = {
  key: string;
  panelType: HealthPanelTypeForParse;
  label: string;
  aliases: string[];
  unit?: string;
};

export type MicrobiotaTaxonDefinition = {
  key: string;
  label: string;
  aliases: string[];
  rank: "phylum" | "family" | "genus" | "species" | "fungi" | "other";
  kind: "bacteria" | "fungi" | "other";
};

export const HEALTH_MARKERS: HealthMarkerDefinition[] = [
  { key: "emoglobina", panelType: "blood", label: "Emoglobina", aliases: ["emoglobina", "hemoglobin", "hgb", "hb"], unit: "g/dL" },
  { key: "rbc", panelType: "blood", label: "Globuli rossi", aliases: ["rbc", "eritrociti", "globuli rossi", "red blood cells"], unit: "10^6/uL" },
  { key: "wbc", panelType: "blood", label: "Globuli bianchi", aliases: ["wbc", "leucociti", "globuli bianchi", "white blood cells"], unit: "10^3/uL" },
  { key: "hct", panelType: "blood", label: "Ematocrito", aliases: ["hct", "ematocrito", "hematocrit"], unit: "%" },
  { key: "mcv", panelType: "blood", label: "MCV", aliases: ["mcv", "volume corpuscolare medio"], unit: "fL" },
  { key: "mch", panelType: "blood", label: "MCH", aliases: ["mch", "contenuto emoglobinico medio"], unit: "pg" },
  { key: "mchc", panelType: "blood", label: "MCHC", aliases: ["mchc", "concentrazione emoglobinica corpuscolare media"], unit: "g/dL" },
  { key: "plt", panelType: "blood", label: "Piastrine", aliases: ["plt", "platelets", "piastrine"], unit: "10^3/uL" },
  { key: "rdw", panelType: "blood", label: "RDW", aliases: ["rdw"], unit: "%" },
  { key: "ferritina", panelType: "blood", label: "Ferritina", aliases: ["ferritina", "ferritin"], unit: "ng/mL" },
  { key: "vit_d", panelType: "blood", label: "Vitamina D", aliases: ["vitamina d", "vitamin d", "25-oh", "25 oh", "25-hydroxy", "calcidiolo"], unit: "ng/mL" },
  { key: "b12", panelType: "blood", label: "Vitamina B12", aliases: ["vitamina b12", "vit b12", "b12", "cobalamin"], unit: "pg/mL" },
  { key: "glicemia", panelType: "blood", label: "Glicemia", aliases: ["glicemia", "glycemia", "glucose", "glucosio", "fasting glucose"], unit: "mg/dL" },
  { key: "hba1c", panelType: "blood", label: "HbA1c", aliases: ["hba1c", "a1c", "emoglobina glicata", "glycated hemoglobin"], unit: "%" },

  { key: "cortisol_am", panelType: "hormones", label: "Cortisolo mattutino", aliases: ["cortisolo mattutino", "cortisol morning", "cortisol am", "cortisol 8"], unit: "ug/dL" },
  { key: "cortisol_pm", panelType: "hormones", label: "Cortisolo serale", aliases: ["cortisolo serale", "cortisol evening", "cortisol pm"], unit: "ug/dL" },
  { key: "testosterone", panelType: "hormones", label: "Testosterone", aliases: ["testosterone", "testosterone totale", "tt"], unit: "ng/dL" },
  { key: "free_testosterone", panelType: "hormones", label: "Testosterone libero", aliases: ["free testosterone", "testosterone libero", "ft"], unit: "pg/mL" },
  { key: "estradiol", panelType: "hormones", label: "Estradiolo", aliases: ["estradiol", "estradiolo", "e2"], unit: "pg/mL" },
  { key: "progesterone", panelType: "hormones", label: "Progesterone", aliases: ["progesterone"], unit: "ng/mL" },
  { key: "lh", panelType: "hormones", label: "LH", aliases: ["lh", "luteinizing hormone", "ormone luteinizzante"], unit: "mIU/mL" },
  { key: "fsh", panelType: "hormones", label: "FSH", aliases: ["fsh", "follicle stimulating hormone", "ormone follicolo-stimolante"], unit: "mIU/mL" },
  { key: "tsh", panelType: "hormones", label: "TSH", aliases: ["tsh", "tirotropina", "thyrotropin"], unit: "uIU/mL" },
  { key: "t3", panelType: "hormones", label: "T3", aliases: ["t3", "ft3", "free t3", "t3 libera"], unit: "pg/mL" },
  { key: "t4", panelType: "hormones", label: "T4", aliases: ["t4", "ft4", "free t4", "t4 libera"], unit: "ng/dL" },
  { key: "dhea", panelType: "hormones", label: "DHEA", aliases: ["dhea", "dehydroepiandrosterone", "deidroepiandrosterone"], unit: "ug/dL" },
  { key: "igf1", panelType: "hormones", label: "IGF-1", aliases: ["igf-1", "igf1", "somatomedina c"], unit: "ng/mL" },

  { key: "crp_mg_l", panelType: "inflammation", label: "PCR-us", aliases: ["pcr-us", "pcr us", "hs-crp", "hscrp", "crp", "proteina c reattiva"], unit: "mg/L" },
  { key: "il6", panelType: "inflammation", label: "IL-6", aliases: ["il-6", "il 6", "interleukin 6", "interleuchina 6"], unit: "pg/mL" },
  { key: "tnf_alpha", panelType: "inflammation", label: "TNF-alpha", aliases: ["tnf-alpha", "tnf alpha", "tnfα", "tumor necrosis"], unit: "pg/mL" },
  { key: "homocysteine", panelType: "inflammation", label: "Omocisteina", aliases: ["omocisteina", "homocysteine", "hcy"], unit: "umol/L" },
  { key: "oxidized_ldl", panelType: "inflammation", label: "LDL ossidato", aliases: ["ldl ossidat", "oxidized ldl", "ox-ldl", "oxldl"], unit: "U/L" },

  { key: "roms_carr", panelType: "oxidative_stress", label: "d-ROMs", aliases: ["d-rom", "d rom", "roms", "diacron"], unit: "Carr U" },
  { key: "bap_umol", panelType: "oxidative_stress", label: "BAP", aliases: ["bap", "potenziale antiossidante"], unit: "umol/L" },
  { key: "glutathione", panelType: "oxidative_stress", label: "Glutatione", aliases: ["glutatione", "glutathione", "gsh"] },
  { key: "sod", panelType: "oxidative_stress", label: "SOD", aliases: ["sod", "superoxide dismutase", "dismutasi"] },
  { key: "catalase", panelType: "oxidative_stress", label: "Catalasi", aliases: ["catalasi", "catalase", "cat"] },

  { key: "methylation_score", panelType: "epigenetics", label: "Methylation score", aliases: ["metilazione", "methylation", "dna methylation"] },
  { key: "biological_age_delta", panelType: "epigenetics", label: "Delta età biologica", aliases: ["età biologica", "biological age", "epigenetic age"] },
  { key: "epigenetic_detox", panelType: "epigenetics", label: "Detox epigenetico", aliases: ["detox", "detossificazione", "xenobiotic"] },
  { key: "epigenetic_repair", panelType: "epigenetics", label: "DNA repair", aliases: ["riparazione dna", "dna repair", "repair pathway"] },
  { key: "epigenetic_oxidative_stress", panelType: "epigenetics", label: "Stress ossidativo epigenetico", aliases: ["stress ossidativo", "oxidative stress", "ros"] },
];

export const MICROBIOTA_TAXA: MicrobiotaTaxonDefinition[] = [
  { key: "firmicutes", label: "Firmicutes", aliases: ["firmicutes", "firmicuti"], rank: "phylum", kind: "bacteria" },
  { key: "bacteroidetes", label: "Bacteroidetes", aliases: ["bacteroidetes", "batteroideti"], rank: "phylum", kind: "bacteria" },
  { key: "proteobacteria", label: "Proteobacteria", aliases: ["proteobacteria", "proteobatteri"], rank: "phylum", kind: "bacteria" },
  { key: "actinobacteria", label: "Actinobacteria", aliases: ["actinobacteria", "attinobatteri"], rank: "phylum", kind: "bacteria" },
  { key: "akkermansia", label: "Akkermansia", aliases: ["akkermansia", "akkermansia muciniphila"], rank: "genus", kind: "bacteria" },
  { key: "bifidobacterium", label: "Bifidobacterium", aliases: ["bifidobacterium", "bifidobacteria"], rank: "genus", kind: "bacteria" },
  { key: "lactobacillus", label: "Lactobacillus", aliases: ["lactobacillus", "lactobacilli"], rank: "genus", kind: "bacteria" },
  { key: "faecalibacterium", label: "Faecalibacterium", aliases: ["faecalibacterium", "f. prausnitzii", "prausnitzii"], rank: "genus", kind: "bacteria" },
  { key: "candida", label: "Candida", aliases: ["candida", "candida albicans"], rank: "fungi", kind: "fungi" },
  { key: "saccharomyces", label: "Saccharomyces", aliases: ["saccharomyces", "saccharomyces boulardii"], rank: "fungi", kind: "fungi" },
];

export const EPIGENETIC_GENE_BANK: string[] = [
  "MTHFR",
  "COMT",
  "MTR",
  "MTRR",
  "CBS",
  "DNMT1",
  "DNMT3A",
  "DNMT3B",
  "TET1",
  "TET2",
  "TET3",
  "SOD2",
  "CAT",
  "GPX1",
  "NFE2L2",
  "NRF2",
  "KEAP1",
  "FOXO3",
  "SIRT1",
  "APOE",
  "FTO",
  "PPARGC1A",
  "IL6",
  "TNF",
  "CRP",
];
