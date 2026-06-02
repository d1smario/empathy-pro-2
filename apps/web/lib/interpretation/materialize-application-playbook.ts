import type { EmpathyApplicationPlaybook } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";

export type MaterializedPlaybookLines = {
  integrationLeverLines: string[];
  contextLines: string[];
  pathwayTimingLines: string[];
};

/**
 * Inietta il playbook nel request meal plan senza alterare target kcal/macro (Compute).
 */
export function materializeApplicationPlaybookForMealPlanRequest(
  request: IntelligentMealPlanRequest,
  playbook: EmpathyApplicationPlaybook | null | undefined,
): MaterializedPlaybookLines {
  if (!playbook) {
    return { integrationLeverLines: [], contextLines: [], pathwayTimingLines: [] };
  }

  const integrationLeverLines: string[] = [];
  const contextLines: string[] = [];
  const pathwayTimingLines: string[] = [];

  integrationLeverLines.push(`Playbook EMPATHY: ${playbook.playbookHeadlineIt.slice(0, 120)}`);

  for (const d of playbook.directives.slice(0, 3)) {
    integrationLeverLines.push(`${d.headlineIt}: ${d.actionIt}`.slice(0, 160));
  }

  for (const n of playbook.nutritionAdvice.slice(0, 4)) {
    contextLines.push(
      `[Nutrizione · ${n.timingWindowIt}] ${n.headlineIt}: ${n.actionIt}`.slice(0, 220),
    );
  }

  for (const tp of playbook.timingProtocols.slice(0, 8)) {
    pathwayTimingLines.push(
      `[${tp.pathwayLabel ?? "Protocollo"}] ${tp.phase} ${tp.windowLabelIt}: ${tp.actionsIt.join("; ")}`.slice(
        0,
        200,
      ),
    );
  }

  if (playbook.fuelingAdvice) {
    contextLines.push(
      `[Fueling · ${playbook.fuelingAdvice.sessionLabel}] ${playbook.fuelingAdvice.protocolNotes.join(" · ")}`.slice(
        0,
        240,
      ),
    );
    for (const h of playbook.fuelingAdvice.integrationFavoring.slice(0, 2)) {
      contextLines.push(
        `Integrazione favorevole: ${h.productClass} — ${h.reasonIt} (${h.timingIt})`.slice(0, 200),
      );
    }
  }

  for (const a of playbook.advisoryNotes.slice(0, 3)) {
    contextLines.push(`[${a.sector}] ${a.textIt}`.slice(0, 180));
  }

  return {
    integrationLeverLines: integrationLeverLines.slice(0, 16),
    contextLines: contextLines.slice(0, 20),
    pathwayTimingLines: pathwayTimingLines.slice(0, 32),
  };
}

export function mergePlaybookIntoMealPlanRequest(
  request: IntelligentMealPlanRequest,
  playbook: EmpathyApplicationPlaybook | null | undefined,
): IntelligentMealPlanRequest {
  const lines = materializeApplicationPlaybookForMealPlanRequest(request, playbook);
  if (!lines.integrationLeverLines.length && !lines.contextLines.length) {
    return request;
  }

  return {
    ...request,
    contextLines: [
      ...request.contextLines.filter((l) => !l.startsWith("[Nutrizione ·") && !l.startsWith("[Fueling ·")),
      ...lines.contextLines,
    ].slice(0, 24),
    pathwayTimingLines: [
      ...request.pathwayTimingLines.filter((l) => !l.includes("Playbook EMPATHY")),
      ...lines.pathwayTimingLines,
    ].slice(0, 32),
    mealPlanSolverMeta: {
      ...request.mealPlanSolverMeta,
      integrationLeverLines: [
        ...request.mealPlanSolverMeta.integrationLeverLines.filter((l) => !l.startsWith("Playbook EMPATHY")),
        ...lines.integrationLeverLines,
      ].slice(0, 16),
    },
  };
}
