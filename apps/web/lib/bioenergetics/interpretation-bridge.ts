import { getMultiscaleNode } from "@empathy/domain-knowledge";
import type { BioenergeticInterpretationHint } from "@/api/bioenergetics/contracts";
import type { BioenergeticDayKernelOutput } from "@/api/bioenergetics/contracts";

function nodeLabel(nodeId: string, fallback: string): string {
  const node = getMultiscaleNode(nodeId);
  if (!node) return fallback;
  return node.labelIt || node.label || fallback;
}

export function buildBioenergeticInterpretationHints(kernel: BioenergeticDayKernelOutput): BioenergeticInterpretationHint[] {
  const hints: BioenergeticInterpretationHint[] = [];

  const endocrineNode = kernel.pathwayState === "supportive" ? "cascade.gh_igf" : "cascade.hpa";
  hints.push({
    pathwayId: endocrineNode,
    level: "hormonal",
    title: nodeLabel(endocrineNode, "Asse endocrino"),
    detail:
      kernel.pathwayState === "supportive"
        ? "Domanda energetica e gestione substrati risultano coerenti con un assetto favorevole alla performance."
        : "Il contesto suggerisce maggiore pressione stress/accumulo: utile intervenire su timing e distribuzione carichi.",
  });

  const metabolicNode = kernel.insulinDemandScore > kernel.glucoseHandlingScore ? "axis.ampk_mtor" : "cluster.nutrient_handling";
  hints.push({
    pathwayId: metabolicNode,
    level: "metabolic",
    title: nodeLabel(metabolicNode, "Nutrient handling"),
    detail:
      kernel.insulinDemandScore > kernel.glucoseHandlingScore
        ? "Aumentare il pull energetico o ridurre il picco CHO nelle finestre a bassa richiesta puo migliorare l'efficienza."
        : "Il pattern indica buona partizione dei substrati tra disponibilita energetica e richieste del tessuto attivo.",
  });

  const microbiotaNode = "microbiota.scfa_ampk";
  hints.push({
    pathwayId: microbiotaNode,
    level: "microbiota",
    title: nodeLabel(microbiotaNode, "Contesto microbiota"),
    detail: "La tolleranza intestinale e la qualita della distribuzione CHO influenzano il segnale metabolico complessivo.",
  });

  return hints;
}
