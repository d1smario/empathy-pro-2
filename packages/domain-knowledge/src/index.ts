/** Corpus, mechanisms, bindings, research traces — never replaces twin truth. */
import type {
  KnowledgeExpansionTrace,
  KnowledgeQueryInput,
  KnowledgeResearchTraceSummary,
  ResearchPlan,
  ResearchPlanStatus,
} from "@empathy/contracts";

/** Punto 3 — boundary knowledge: tipi da contratti, logica pura sotto. */
export const DOMAIN = "@empathy/domain-knowledge" as const;
export const DOMAIN_TITLE = "Knowledge";
export const DOMAIN_SUMMARY =
  "Piani di ricerca, trace di espansione e riassunti — tipi API + schemi da @empathy/contracts (AI ai confini).";

export type {
  KnowledgeExpansionTrace,
  KnowledgeQueryInput,
  KnowledgeResearchTraceSummary,
  ResearchPlan,
  ResearchPlanStatus,
};

export function countResearchPlanHops(plan: ResearchPlan): number {
  return plan.hops.length;
}
