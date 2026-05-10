import { getMultiscaleNode } from "@empathy/domain-knowledge";
import { tssPlanExecutionRatio } from "@empathy/domain-bioenergetics";
import type { BioenergeticChannelProvenance, BioenergeticInterpretationHint } from "@/api/bioenergetics/contracts";
import type { BioenergeticDayKernelOutput } from "@/api/bioenergetics/contracts";

/** Segnali giornalieri per hint “azioni” (aderenza substrato, completezza diario, dati misurati). */
export type BioenergeticDayActionContext = {
  diaryEntryCount: number;
  choIntakeG: number;
  executedTssSum: number;
  /** Σ TSS pianificato per la giornata (stesso slice calendario). */
  plannedTssSum?: number;
  glucoseProvenance: BioenergeticChannelProvenance;
};

function nodeLabel(nodeId: string, fallback: string): string {
  const node = getMultiscaleNode(nodeId);
  if (!node) return fallback;
  return node.labelIt || node.label || fallback;
}

export function buildBioenergeticInterpretationHints(
  kernel: BioenergeticDayKernelOutput,
  day?: BioenergeticDayActionContext,
): BioenergeticInterpretationHint[] {
  const hints: BioenergeticInterpretationHint[] = [];

  if (day) {
    if (day.executedTssSum >= 40 && day.diaryEntryCount === 0) {
      hints.push({
        pathwayId: "ops.diary_gap",
        level: "metabolic",
        title: "Diario vuoto con carico reale",
        detail:
          "C’è allenamento eseguito ma nessuna voce nel diario per questa data: il modello non può incrociare CHO/pasti con il carico. Aggiungi le voci (stessa data del report) per stimare aderenza substrato e finestre insuliniche.",
      });
    }
    if (day.executedTssSum >= 75 && day.choIntakeG < 120) {
      hints.push({
        pathwayId: "ops.cho_training_mismatch",
        level: "metabolic",
        title: "CHO diario vs domanda allenamento",
        detail:
          "Carico elevato (Σ TSS) con apporto carboidrato cumulato contenuto nel diario: possibile sottocopertura per recupero/glicogeno. Valuta timing e quantità, o conferma fueling se assunto ma non registrato.",
      });
    }
    if (day.glucoseProvenance === "estimated" && day.diaryEntryCount > 0) {
      hints.push({
        pathwayId: "ops.glucose_model_only",
        level: "metabolic",
        title: "Curva glucosio modello",
        detail:
          "Non risultano letture CGM o glicemia lab per la giornata: la curva glucosio è stimata dal kernel, non sovrapposta a misure. Con dati reali si potrà confrontare modello vs osservato.",
      });
    }
    const planned = day.plannedTssSum ?? 0;
    if (planned > 10 && day.executedTssSum >= 0) {
      const ratio = tssPlanExecutionRatio(day.executedTssSum, planned);
      if (ratio != null && (ratio < 0.72 || ratio > 1.35)) {
        hints.push({
          pathwayId: "ops.tss_plan_execution_gap",
          level: "metabolic",
          title: "Carico eseguito vs pianificato (TSS)",
          detail:
            ratio < 0.72
              ? "Il TSS cumulato eseguito è nettamente sotto il piano del giorno: possibile recupero attivo, seduta saltata o import incompleto. Verifica calendario e traccia."
              : "Il TSS cumulato eseguito supera di molto il piano: adattamento maggiore del previsto o pianificazione conservativa — controlla recovery e substrato.",
        });
      }
    }
  }

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
