import type { AdaptationGuidance } from "@/lib/empathy/schemas/adaptation";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";
import type { TrainingDayOperationalContext } from "@/lib/training/day-operational-context";

type LoopPick = { status: string; nextAction: string } | null;

/**
 * Righe deterministiche riusabili: training operativo, adattamento twin, loop calendario, dial nutrizione↔training.
 * Parità V1 (`nextjs-empathy-pro/lib/platform/operational-dynamics-lines.ts`).
 */
export function buildOperationalDynamicsLines(input: {
  adaptationGuidance?: AdaptationGuidance | null;
  operationalContext?: TrainingDayOperationalContext | null;
  nutritionPerformanceIntegration?: NutritionPerformanceIntegrationDials | null;
  adaptationLoop?: LoopPick;
}): string[] {
  const lines: string[] = [];
  const ag = input.adaptationGuidance ?? null;
  const op = input.operationalContext ?? null;
  const nut = input.nutritionPerformanceIntegration ?? null;
  const loop = input.adaptationLoop ?? null;

  if (ag) {
    lines.push(
      `[Adattamento] Semaforo ${ag.trafficLight} · rapporto osservato/atteso ${ag.scorePct}% (atteso ${ag.expectedAdaptation}, osservato ${ag.observedAdaptation})`,
    );
    if (!ag.keepProgramUnchanged && (ag.reductionMinPct > 0 || ag.reductionMaxPct > 0)) {
      lines.push(
        `[Training] Fascia riduzione volume operativa suggerita: ${ag.reductionMinPct}-${ag.reductionMaxPct}% rispetto al piano nominale`,
      );
    }
  }

  if (op) {
    lines.push(
      `[Training↔piattaforma] Carico operativo ~${op.loadScalePct}% · modalità ${op.mode} · ${op.headline}`,
    );
  }

  if (loop) {
    lines.push(`[Calendario] Loop esecuzione: ${loop.status} → azione ${loop.nextAction}`);
  }

  if (nut) {
    lines.push(
      `[Nutrizione↔Training] Energia da seduta ×${nut.trainingEnergyScale.toFixed(2)} · quota pasti sul training ${Math.round(nut.mealTrainingFraction * 100)}% · CHO intra ×${nut.fuelingChoScale.toFixed(2)} · idratazione ×${nut.hydrationFloorMultiplier.toFixed(2)}`,
    );
  }

  return lines;
}
