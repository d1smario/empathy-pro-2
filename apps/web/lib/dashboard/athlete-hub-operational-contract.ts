import type { OperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";

/** Risposta `ok: true` di `GET /api/dashboard/athlete-hub` con `includeOperationalSignals=1`. */
export type AthleteHubOperationalOk = {
  ok: true;
  athleteId: string;
  window: { from: string; to: string };
  profile: { line: string } | null;
  training: {
    plannedCount: number;
    executedCount: number;
    analyzerAligned: {
      basis: "tss_rolling_windows";
      fromDate: string;
      toDate: string;
      last7: { planned: number; executed: number; compliancePct: number };
      last28: { planned: number; executed: number; compliancePct: number };
    };
  };
  nutrition: { constraintsLine: string | null; plansCount: number };
  physiology: { line: string } | null;
  health: { panelsCount: number; lastPanelLabel: string | null };
  readSpineCoverage: ReadSpineCoverageSummary;
  operationalSignals: OperationalSignalsBundle | null;
  crossModuleDynamicsLines: string[];
  /** Ultimo delta expected-vs-obtained persistito (loop chiusura + hint trace coach se presenti). */
  expectedVsObtainedPreview: {
    date: string | null;
    status: string | null;
    loopClosureSummary: string | null;
    recentCoachTracesInHint: number;
  } | null;
};

export type AthleteHubOperationalErr = { ok: false; error?: string };

export function athleteHubOperationalUrl(athleteId: string): string {
  return `/api/dashboard/athlete-hub?athleteId=${encodeURIComponent(athleteId)}&includeOperationalSignals=1`;
}
