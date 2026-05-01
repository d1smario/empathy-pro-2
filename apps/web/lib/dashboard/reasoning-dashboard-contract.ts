export type ReasoningTone = "amber" | "cyan" | "violet" | "green" | "rose" | "slate";

export type ReasoningSourceRef = {
  table?: string;
  id?: string;
  label?: string;
  kind?: string;
};

export type ReasoningCardVm = {
  id: string;
  domain: "training" | "nutrition" | "health" | "recovery" | "physiology" | "bioenergetics" | "cross_module";
  title: string;
  value: string;
  subtitle: string;
  tone: ReasoningTone;
  status: string;
  confidence: number | null;
  explanation: string;
  actionLines: string[];
  evidenceLines: string[];
  riskLines: string[];
  timingLines: string[];
  sourceRefs: ReasoningSourceRef[];
  stagingRunId: string | null;
  createdAt: string | null;
};

export type ReasoningDashboardOk = {
  ok: true;
  athleteId: string;
  generatedAt: string;
  cards: ReasoningCardVm[];
  summary: {
    pending: number;
    committed: number;
    rejected: number;
    archived: number;
    total: number;
  };
};

export type ReasoningDashboardErr = {
  ok: false;
  error?: string;
};

export function reasoningDashboardUrl(athleteId: string): string {
  return `/api/dashboard/reasoning?athleteId=${encodeURIComponent(athleteId)}`;
}
