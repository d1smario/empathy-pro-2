import type {
  EmpathyCanonicalQuestionAnswer,
  EmpathyInterrogationLevelState,
  EmpathyInterrogationMap,
  EmpathyInterrogationSectorState,
  EmpathyProbeStatus,
} from "@empathy/contracts";
import {
  CANONICAL_INTERROGATION_QUESTIONS,
  INTERROGATION_LEVEL_LABELS_IT,
  resolveStimulusProfileFromAdaptationTarget,
} from "@empathy/domain-knowledge";
import type { NutritionPathwayModulationViewModel } from "@/api/nutrition/contracts";
import type { HealthLabPathwayBridgeResult } from "@/lib/nutrition/health-lab-pathway-bridge";
import type { HealthPanelModulatorBridgeResult } from "@/lib/nutrition/health-panel-modulator-bridge";
import type { MultiscalePathwayBridgeResult } from "@/lib/nutrition/multiscale-pathway-bridge";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";

export type BuildEmpathyInterrogationMapInput = {
  athleteId: string;
  anchorDate: string;
  plannedSessions: Array<{ label: string; adaptationTarget: string | null }>;
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  multiscaleBridge: MultiscalePathwayBridgeResult | null;
  healthLabBridge: HealthLabPathwayBridgeResult | null;
  healthPanelModulators: HealthPanelModulatorBridgeResult | null;
  recoverySummary: RecoverySummary | null;
};

function sector(
  sectorId: EmpathyInterrogationSectorState["sectorId"],
  status: EmpathyProbeStatus,
  summaryIt: string,
  evidenceRefs: string[] = [],
  linkedQuestionIds: string[] = [],
): EmpathyInterrogationSectorState {
  return { sectorId, status, summaryIt, evidenceRefs, linkedQuestionIds };
}

function level(
  levelId: EmpathyInterrogationLevelState["levelId"],
  sectors: EmpathyInterrogationSectorState[],
): EmpathyInterrogationLevelState {
  return { levelId, labelIt: INTERROGATION_LEVEL_LABELS_IT[levelId], sectors };
}

function answerQuestion(
  q: (typeof CANONICAL_INTERROGATION_QUESTIONS)[number],
  status: EmpathyProbeStatus,
  answerIt: string,
  evidenceRefs: string[] = [],
  deferredProbeKey?: string,
): EmpathyCanonicalQuestionAnswer {
  return {
    questionId: q.id,
    promptIt: q.promptIt,
    status,
    answerIt,
    evidenceRefs,
    ...(deferredProbeKey ? { deferredProbeKey } : {}),
  };
}

export function buildEmpathyInterrogationMap(input: BuildEmpathyInterrogationMapInput): EmpathyInterrogationMap {
  const primary = input.plannedSessions[0];
  const adaptation = primary?.adaptationTarget ?? null;
  const stimulus = resolveStimulusProfileFromAdaptationTarget(adaptation);
  const pathways = input.pathwayModulation?.pathways ?? [];
  const pathwayLabels = pathways.map((p) => p.pathwayLabel);
  const hasLab = (input.healthLabBridge?.markerSignals.length ?? 0) > 0;
  const panelMicro = input.healthPanelModulators?.subDomainsActive.includes("microbiota");
  const panelEpigen = input.healthPanelModulators?.subDomainsActive.includes("epigenetics");
  const multiscaleWired = Boolean(input.multiscaleBridge?.pathwayExtension);

  const levels: EmpathyInterrogationLevelState[] = [
    level("L1_stimulus", [
      sector(
        "training",
        input.plannedSessions.length ? "answered" : "deferred",
        input.plannedSessions.length
          ? `${stimulus.labelIt}${primary?.label ? ` · ${primary.label}` : ""}`
          : "Nessuna seduta pianificata — stimolo da routine o recovery.",
        input.plannedSessions.map((_, i) => `planned_session:${i}`),
        ["q01_training"],
      ),
    ]),
    level("L2_energy_systems", [
      sector(
        "energy_systems",
        "answered",
        stimulus.energySystems.join(" · ") || "aerobic_oxidative",
        [`stimulus:${stimulus.id}`],
        ["q02_energy_systems", "q07_substrates"],
      ),
    ]),
    level("L3_molecular_pathways", [
      sector(
        "molecular_pathways",
        pathwayLabels.length ? "answered" : "active",
        pathwayLabels.length
          ? pathwayLabels.slice(0, 4).join(" · ")
          : "Pathway template da twin/fisiologia quando seduta assente.",
        pathwayLabels.map((_, i) => `pathway:${i}`),
        ["q03_pathways", "q08_cofactors"],
      ),
    ]),
    level("L4_neuroendocrine", [
      sector(
        "neuroendocrine",
        input.recoverySummary?.guidance || typeof input.recoverySummary?.status === "string"
          ? "answered"
          : "deferred",
        input.recoverySummary?.guidance?.trim() ||
          (input.recoverySummary?.status
            ? `Recovery: ${input.recoverySummary.status}`
            : "Asse neuroendocrino: proxy readiness/recovery finché non ci sono biomarker ormonali."),
        input.recoverySummary?.status ? [`recovery:${input.recoverySummary.status}`] : [],
        ["q04_hormones"],
      ),
    ]),
    level("L5_microbiota", [
      sector(
        "microbiota",
        panelMicro || pathways.some((p) => p.systemLevels.includes("microbiota"))
          ? "answered"
          : "deferred",
        panelMicro
          ? "Panel microbiota collegato."
          : pathways.some((p) => p.systemLevels.includes("microbiota"))
            ? "Barriera/assorbimento da pathway gut."
            : "Microbiota — in attesa panel o session knowledge.",
        panelMicro ? ["health_panel:microbiota"] : [],
        ["q05_neurotransmitters", "q10_microbiota_bacteria"],
      ),
    ]),
    level("L6_environment", [
      sector(
        "environment",
        "deferred",
        "Caldo/freddo/quota/sonno — ingest ambientale non ancora cablato in questa release.",
        [],
        ["q11_environment"],
      ),
    ]),
    level("L7_bioenergetics", [
      sector(
        "bioenergetics",
        "deferred",
        "Moduli luce/EMF/red-NIR in backlog; non modulano solver in questa fase.",
        [],
        [],
      ),
    ]),
    level("L8_gene_networks", [
      sector(
        "gene_networks",
        multiscaleWired || stimulus.geneNetworkTags.length ? "answered" : "deferred",
        multiscaleWired
          ? `Ontologia multiscala (${input.multiscaleBridge!.activatedNodeIds.length} nodi).`
          : stimulus.geneNetworkTags.join(" · ") || "Network genici — deferred.",
        multiscaleWired ? ["multiscale:ontology"] : stimulus.geneNetworkTags.map((t) => `network:${t}`),
        ["q06_gene_networks"],
      ),
    ]),
    level("L9_interrogation", []),
    level("L10_decision", [
      sector(
        "nutrition_levers",
        "active",
        "Playbook nutrition + fueling generato da pathway e solver.",
        ["decision:playbook"],
        ["q14_levers"],
      ),
    ]),
  ];

  const canonicalQuestions: EmpathyCanonicalQuestionAnswer[] = CANONICAL_INTERROGATION_QUESTIONS.map((q) => {
    switch (q.id) {
      case "q01_training":
        return answerQuestion(
          q,
          input.plannedSessions.length ? "answered" : "deferred",
          input.plannedSessions.length
            ? input.plannedSessions.map((s) => `${s.label} (${s.adaptationTarget ?? "—"})`).join("; ")
            : "Nessuna seduta in calendario.",
          input.plannedSessions.map((_, i) => `planned_session:${i}`),
        );
      case "q02_energy_systems":
        return answerQuestion(q, "answered", stimulus.energySystems.join(", "), [`stimulus:${stimulus.id}`]);
      case "q03_pathways":
        return answerQuestion(
          q,
          pathwayLabels.length ? "answered" : "deferred",
          pathwayLabels.slice(0, 6).join(" · ") || "Nessun pathway attivo.",
          pathwayLabels.map((_, i) => `pathway:${i}`),
        );
      case "q08_cofactors": {
        const cof = pathways.flatMap((p) => p.cofactors).slice(0, 8);
        return answerQuestion(
          q,
          cof.length ? "answered" : "deferred",
          cof.join(" · ") || "Vedi pathway modulation.",
          ["pathway:cofactors"],
        );
      }
      case "q12_biomarkers":
        return answerQuestion(
          q,
          hasLab ? "answered" : "deferred",
          hasLab
            ? input.healthLabBridge!.markerSignals.map((m) => `${m.marker}=${m.value}`).join(" · ")
            : "Nessun marker ematico strutturato oggi.",
          hasLab ? ["health_lab:markers"] : [],
          hasLab ? undefined : "health.lab",
        );
      case "q13_deficits": {
        const lows = input.healthLabBridge?.markerSignals.filter((m) => m.status === "low") ?? [];
        return answerQuestion(
          q,
          lows.length ? "answered" : hasLab ? "answered" : "deferred",
          lows.length
            ? `Segnali bassi: ${lows.map((m) => m.marker).join(", ")}`
            : hasLab
              ? "Nessun deficit marcato dalle soglie conservative."
              : "Gap analysis richiede panel ematici.",
          lows.map((m) => `lab:${m.marker}`),
        );
      }
      case "q14_levers":
        return answerQuestion(
          q,
          "answered",
          "Nutrition (pasti), Fueling (peri/intra), Recovery, Training scale, Dashboard KPI.",
          ["decision:levers"],
        );
      case "q10_microbiota_bacteria":
        return answerQuestion(
          q,
          panelMicro ? "active" : "deferred",
          panelMicro ? "Modulatori microbiota da Health panel." : "Panel microbiota non collegato.",
          panelMicro ? ["health_panel:microbiota"] : [],
          panelMicro ? undefined : "microbiome.expand_16s",
        );
      case "q11_environment":
        return answerQuestion(q, "deferred", "Ingest ambiente non cablato.", [], "environment.ingest");
      case "q06_gene_networks":
        return answerQuestion(
          q,
          multiscaleWired || stimulus.geneNetworkTags.length ? "answered" : "active",
          [...stimulus.geneNetworkTags, ...(multiscaleWired ? ["multiscale_active"] : [])].join(" · ") || "—",
          multiscaleWired ? ["multiscale:ontology"] : [],
        );
      default:
        return answerQuestion(q, "active", "Vedi settori L1–L8 e playbook L10.", ["interrogation:rollup"]);
    }
  });

  const headline =
    input.plannedSessions.length > 0
      ? `Interrogazione ${input.anchorDate}: ${stimulus.labelIt} · ${pathwayLabels.length} vie attive`
      : `Interrogazione ${input.anchorDate}: giorno senza seduta pianificata`;

  return {
    schemaVersion: 1,
    policyVersion: "empathy.interrogation.policy_v1",
    catalogVersion: "empathy.interrogation.catalog_v1",
    athleteId: input.athleteId,
    anchorDate: input.anchorDate,
    headlineIt: headline,
    levels,
    canonicalQuestions,
    activatedPathwayLabels: pathwayLabels,
    activatedEnergySystems: stimulus.energySystems,
    activatedGeneNetworks: [
      ...new Set([
        ...stimulus.geneNetworkTags,
        ...(multiscaleWired ? ["multiscale_ontology"] : []),
        ...(panelEpigen ? ["epigenetics_panel"] : []),
      ]),
    ],
  };
}
