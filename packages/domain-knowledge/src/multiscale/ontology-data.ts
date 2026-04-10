/**
 * Canonical ontology seed (versioned). Extend via migrations + curated JSON in DB later.
 * Not clinical truth — tags for knowledge bindings / interpretation only.
 */
import type { MultiscaleEdge, MultiscaleNode, MultiscaleScaleId } from "./types";
import { MULTISCALE_ONTOLOGY_VERSION } from "./types";

export { MULTISCALE_ONTOLOGY_VERSION };

const S = {
  genome: "genome_epigenome" as MultiscaleScaleId,
  trx: "transcriptome" as MultiscaleScaleId,
  prot: "proteome" as MultiscaleScaleId,
  meta: "metabolome" as MultiscaleScaleId,
  cell: "cell_signalling" as MultiscaleScaleId,
  tissue: "tissue" as MultiscaleScaleId,
  sys: "systems" as MultiscaleScaleId,
  body: "whole_body" as MultiscaleScaleId,
};

export const BIOLOGICAL_SCALE_ORDER: MultiscaleScaleId[] = [
  S.genome,
  S.trx,
  S.prot,
  S.meta,
  S.cell,
  S.tissue,
  S.sys,
  S.body,
];

export const ONTOLOGY_NODES: MultiscaleNode[] = [
  { id: "scale.genome", kind: "scale_anchor", label: "Genome / epigenome", labelIt: "Genoma / epigenoma", scale: S.genome, metabolicLevel: 3 },
  { id: "scale.transcriptome", kind: "scale_anchor", label: "Transcriptome", labelIt: "Trascrittoma", scale: S.trx, metabolicLevel: 3 },
  { id: "scale.proteome", kind: "scale_anchor", label: "Proteome", labelIt: "Proteoma", scale: S.prot, metabolicLevel: 2 },
  { id: "scale.metabolome", kind: "scale_anchor", label: "Metabolome", labelIt: "Metaboloma", scale: S.meta, metabolicLevel: 1 },
  { id: "scale.signalling", kind: "scale_anchor", label: "Cell signalling", labelIt: "Segnale cellulare", scale: S.cell, metabolicLevel: 2 },
  { id: "scale.systems", kind: "scale_anchor", label: "Organ systems", labelIt: "Sistemi (endocrino, nervoso, immunitario)", scale: S.sys, metabolicLevel: 4 },
  { id: "scale.whole_body", kind: "scale_anchor", label: "Whole-body physiology", labelIt: "Fisiologia d’organismo", scale: S.body, metabolicLevel: 1 },

  {
    id: "cluster.mito_biogenesis",
    kind: "gene_cluster",
    label: "Mitochondrial biogenesis / PGC-1 axis",
    labelIt: "Biogenesi mitocondriale / asse PGC-1",
    scale: S.trx,
    metabolicLevel: 3,
    symbols: ["PPARGC1A", "NRF1", "TFAM"],
    cofactorNutrientTags: ["b_vitamins", "coq10_context"],
  },
  {
    id: "cluster.energy_sensing",
    kind: "gene_cluster",
    label: "AMPK / energy sensing",
    labelIt: "AMPK / sensing energetico",
    scale: S.cell,
    metabolicLevel: 2,
    symbols: ["PRKAA1", "PRKAA2", "STK11"],
  },
  {
    id: "cluster.sirtuins",
    kind: "gene_cluster",
    label: "SIRT1 / SIRT3 efficiency",
    labelIt: "Sirtuine 1/3 — efficienza mitocondriale",
    scale: S.cell,
    metabolicLevel: 2,
    symbols: ["SIRT1", "SIRT3"],
    cofactorNutrientTags: ["nad_precursors_context"],
  },
  {
    id: "cluster.hypoxia",
    kind: "gene_cluster",
    label: "HIF / hypoxia programme",
    labelIt: "Programma ipossico / HIF",
    scale: S.trx,
    metabolicLevel: 3,
    symbols: ["HIF1A", "VEGFA", "EPO"],
  },
  {
    id: "cluster.neuro_plasticity",
    kind: "gene_cluster",
    label: "BDNF / dopamine context",
    labelIt: "BDNF / contesto dopaminergico",
    scale: S.sys,
    metabolicLevel: 6,
    symbols: ["BDNF", "COMT", "DRD2"],
  },
  {
    id: "cluster.immune_inflammation",
    kind: "gene_cluster",
    label: "NF-κB / cytokine tone",
    labelIt: "NF-κB / tono citochinico",
    scale: S.sys,
    metabolicLevel: 3,
    symbols: ["NFKB1", "IL6", "TNF", "PTGS2"],
    cofactorNutrientTags: ["omega3_context", "polyphenols_context"],
  },
  {
    id: "cluster.nutrient_handling",
    kind: "gene_cluster",
    label: "GLUT4 / CPT1 / mTOR context",
    labelIt: "GLUT4 / CPT1 / contesto mTOR",
    scale: S.cell,
    metabolicLevel: 2,
    symbols: ["SLC2A4", "CPT1A", "MTOR"],
    cofactorNutrientTags: ["leucine_context", "cho_timing"],
  },

  {
    id: "enzyme.pfk",
    kind: "enzyme",
    label: "Phosphofructokinase (glycolysis RL)",
    labelIt: "Fosfofruttochinasi (glicolisi)",
    scale: S.meta,
    metabolicLevel: 1,
    cofactorNutrientTags: ["b_vitamins", "magnesium"],
  },
  {
    id: "enzyme.pdh",
    kind: "enzyme",
    label: "Pyruvate dehydrogenase complex",
    labelIt: "Complesso piruvato deidrogenasi",
    scale: S.meta,
    metabolicLevel: 1,
    cofactorNutrientTags: ["thiamine", "lipoate_context", "magnesium"],
  },
  {
    id: "enzyme.cpt1",
    kind: "enzyme",
    label: "Carnitine palmitoyltransferase 1",
    labelIt: "CPT1 — ossidazione acidi grassi",
    scale: S.meta,
    metabolicLevel: 1,
    cofactorNutrientTags: ["carnitine_context", "magnesium"],
  },
  {
    id: "enzyme.cco",
    kind: "enzyme",
    label: "Cytochrome c oxidase (ETC)",
    labelIt: "Citocromo c ossidasi (catena respiratoria)",
    scale: S.meta,
    metabolicLevel: 1,
    cofactorNutrientTags: ["iron", "copper_context"],
  },

  {
    id: "axis.ampk_mtor",
    kind: "signalling_axis",
    label: "AMPK ↔ mTOR balance",
    labelIt: "Bilanciamento AMPK ↔ mTOR",
    scale: S.cell,
    metabolicLevel: 2,
  },
  {
    id: "axis.hif_o2",
    kind: "signalling_axis",
    label: "HIF ↔ O2 availability",
    labelIt: "HIF ↔ disponibilità O₂",
    scale: S.cell,
    metabolicLevel: 2,
  },
  {
    id: "axis.nrf2_ros",
    kind: "signalling_axis",
    label: "NRF2 ↔ ROS / redox",
    labelIt: "NRF2 ↔ ROS / redox",
    scale: S.cell,
    metabolicLevel: 2,
    cofactorNutrientTags: ["sulfur_compounds", "vitamin_c", "zinc"],
  },

  {
    id: "cascade.hpa",
    kind: "endocrine_cascade",
    label: "HPA: CRH → ACTH → cortisol",
    labelIt: "Asse HPA: CRH → ACTH → cortisolo",
    scale: S.sys,
    metabolicLevel: 4,
  },
  {
    id: "cascade.gh_igf",
    kind: "endocrine_cascade",
    label: "GH → IGF-1 → anabolic signalling",
    labelIt: "GH → IGF-1 — segnale anabolico",
    scale: S.sys,
    metabolicLevel: 4,
  },
  {
    id: "cascade.thyroid",
    kind: "endocrine_cascade",
    label: "TRH → TSH → thyroid hormones",
    labelIt: "Asse tiroideo TRH → TSH → ormoni tiroidei",
    scale: S.sys,
    metabolicLevel: 4,
    cofactorNutrientTags: ["iodine", "selenium"],
  },

  {
    id: "microbiota.scfa_ampk",
    kind: "microbiota_function",
    label: "SCFA → host signalling (AMPK-related)",
    labelIt: "SCFA → segnalazione ospite (contesto AMPK)",
    scale: S.sys,
    metabolicLevel: 5,
  },
  {
    id: "microbiota.butyrate_mito",
    kind: "microbiota_function",
    label: "Butyrate → epithelial / mitochondrial support",
    labelIt: "Butirrato — supporto epiteliale / mitocondriale",
    scale: S.sys,
    metabolicLevel: 5,
  },
  {
    id: "microbiota.lps_barrier",
    kind: "microbiota_function",
    label: "LPS / barrier → immune tone",
    labelIt: "LPS / barriera — tono immunitario",
    scale: S.sys,
    metabolicLevel: 5,
  },

  {
    id: "neuro.cns_fatigue",
    kind: "neuro_tag",
    label: "Central fatigue (serotonin / dopamine context)",
    labelIt: "Fatica centrale (contesto serotonina / dopamina)",
    scale: S.sys,
    metabolicLevel: 6,
  },
  {
    id: "neuro.autonomic",
    kind: "neuro_tag",
    label: "Autonomic tone / HRV context",
    labelIt: "Tono autonomico / contesto HRV",
    scale: S.sys,
    metabolicLevel: 6,
  },
];

export const ONTOLOGY_EDGES: MultiscaleEdge[] = [
  { id: "e.ampk_mtor", subjectId: "cluster.energy_sensing", predicate: "modulates", objectId: "cluster.nutrient_handling", evidenceLevel: "strong" },
  { id: "e.pgc_mito", subjectId: "cluster.mito_biogenesis", predicate: "supports", objectId: "enzyme.cco", evidenceLevel: "moderate" },
  { id: "e.hif_hypoxia", subjectId: "cluster.hypoxia", predicate: "modulates", objectId: "axis.hif_o2", evidenceLevel: "strong" },
  { id: "e.redox_nrf2", subjectId: "cluster.immune_inflammation", predicate: "modulates", objectId: "axis.nrf2_ros", evidenceLevel: "moderate" },
  { id: "e.cpt_fat", subjectId: "enzyme.cpt1", predicate: "supports", objectId: "cluster.nutrient_handling", evidenceLevel: "strong" },
  { id: "e.pfk_cho", subjectId: "enzyme.pfk", predicate: "supports", objectId: "cluster.energy_sensing", evidenceLevel: "moderate" },
  { id: "e.hpa_stress", subjectId: "cascade.hpa", predicate: "modulates", objectId: "neuro.cns_fatigue", evidenceLevel: "weak" },
  { id: "e.scfa_signal", subjectId: "microbiota.scfa_ampk", predicate: "modulates", objectId: "axis.ampk_mtor", evidenceLevel: "exploratory" },
  { id: "e.butyrate", subjectId: "microbiota.butyrate_mito", predicate: "supports", objectId: "cluster.mito_biogenesis", evidenceLevel: "moderate" },
  { id: "e.lps_immune", subjectId: "microbiota.lps_barrier", predicate: "activates", objectId: "cluster.immune_inflammation", evidenceLevel: "moderate" },
];

const NODE_BY_ID = new Map(ONTOLOGY_NODES.map((n) => [n.id, n]));

export function getMultiscaleNode(id: string): MultiscaleNode | undefined {
  return NODE_BY_ID.get(id);
}
