import { inferDomainFromSport } from "@/lib/training/engine/sport-translation";
import type { AdaptationTarget, GeneratedSession, PrimaryPhysiologySystem, SessionBlock } from "@/lib/training/engine/types";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";
import { intensityScore } from "@/lib/training/builder/pro2-intensity";
import type { PlanChartSegment } from "@/lib/training/builder/manual-plan-block";
import type { Pro2BuilderSessionContract, Pro2RenderProfile } from "@/lib/training/builder/pro2-session-contract";
import type { LifestylePlaybookEntry, LifestylePracticeCategory } from "@/lib/training/builder/lifestyle-playbook-catalog";

export type Pro2LifestyleManualRow = {
  id: string;
  playbookItemId: string;
  practiceCategory: LifestylePracticeCategory;
  name: string;
  rounds: number;
  /** Prescrizione testuale: tenute, respiri, durata blocco, ecc. */
  holdOrReps: string;
  restSec: number;
  rpe: number | null;
  executionStyle: string;
  breathPattern: string;
  chainLabel: string;
  technique: string;
  notes: string;
  mediaUrl?: string;
};

function newRowId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `l-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultPro2LifestyleManualRow(partial?: Partial<Pro2LifestyleManualRow>): Pro2LifestyleManualRow {
  return {
    id: partial?.id ?? newRowId(),
    playbookItemId: partial?.playbookItemId ?? "",
    practiceCategory: partial?.practiceCategory ?? "mobility",
    name: partial?.name ?? "Nuova pratica",
    rounds: partial?.rounds ?? 2,
    holdOrReps: partial?.holdOrReps ?? "10 respiri / 60s tenuta",
    restSec: partial?.restSec ?? 45,
    rpe: partial?.rpe ?? null,
    executionStyle: partial?.executionStyle ?? "",
    breathPattern: partial?.breathPattern ?? "",
    chainLabel: partial?.chainLabel ?? "",
    technique: partial?.technique ?? "",
    notes: partial?.notes ?? "",
    mediaUrl: partial?.mediaUrl,
  };
}

export function rowFromLifestylePlaybookEntry(entry: LifestylePlaybookEntry): Pro2LifestyleManualRow {
  return defaultPro2LifestyleManualRow({
    playbookItemId: entry.id,
    practiceCategory: entry.practiceCategory,
    name: entry.name,
    rounds: entry.defaultRounds,
    holdOrReps: entry.defaultHoldOrReps,
    restSec: entry.defaultRestSec,
    executionStyle: entry.defaultExecution,
    breathPattern: entry.defaultBreath,
    technique: entry.defaultCue,
  });
}

function targetSystemForLifestyleAdaptation(adaptation: AdaptationTarget): PrimaryPhysiologySystem {
  if (adaptation === "mobility_capacity") return "mobility";
  if (adaptation === "recovery") return "proprioception";
  return "proprioception";
}

export function formatPro2LifestyleRowCue(row: Pro2LifestyleManualRow): string {
  const rx = `${Math.max(1, row.rounds)}× ${(row.holdOrReps ?? "").trim() || "—"}`;
  const rpe = row.rpe != null && row.rpe > 0 ? ` · RPE ~${row.rpe}` : "";
  const breath = row.breathPattern.trim() ? ` · ${row.breathPattern.trim()}` : "";
  const exe = row.executionStyle.trim() ? ` · ${row.executionStyle.trim()}` : "";
  const rest = row.restSec > 0 ? ` · recupero ${row.restSec}s` : "";
  const chainRaw = (row.chainLabel ?? "").trim();
  const chain = chainRaw ? ` · gruppo ${chainRaw}` : "";
  const tech = row.technique.trim() ? ` · ${row.technique.trim()}` : "";
  return `${rx}${rpe}${breath}${exe}${rest}${chain}${tech}`.trim();
}

/** Stima durata blocco per grafico / contratto (proxy). */
export function estimateLifestyleRowDurationMinutes(row: Pro2LifestyleManualRow): number {
  const rounds = Math.max(1, row.rounds);
  const restMin = Math.max(0, row.restSec) / 60;
  const workMinPerRound = 2.5;
  const minutes = rounds * workMinPerRound + Math.max(0, rounds - 1) * restMin;
  return Math.max(4, Math.min(40, Math.round(minutes)));
}

export function lifestyleManualRowsToChartSegments(rows: Pro2LifestyleManualRow[]): PlanChartSegment[] {
  let order = 1;
  const out: PlanChartSegment[] = [];
  for (const row of rows) {
    const dm = estimateLifestyleRowDurationMinutes(row);
    const sec = Math.max(120, dm * 60);
    out.push({
      id: row.id,
      order: order++,
      label: row.name,
      durationSeconds: sec,
      intensityLabel: "Z2",
      intensityScore: intensityScore("Z2"),
    });
  }
  return out;
}

function summarizeLifestyleRows(rows: Pro2LifestyleManualRow[]): Pro2BuilderSessionContract["summary"] {
  const segs = lifestyleManualRowsToChartSegments(rows);
  const durationSec = segs.reduce((s, x) => s + x.durationSeconds, 0);
  const tss = estimateTssFromSegments(segs);
  const kcal = Math.round(Math.max(0, tss) * 9.3);
  const avgPowerW = durationSec > 0 ? Math.round((95 * durationSec) / durationSec) : 0;
  return { durationSec, tss, kcal, kj: Math.round((avgPowerW * durationSec) / 1000), avgPowerW };
}

export function lifestyleManualRowsToGeneratedSession(params: {
  sport: string;
  rows: Pro2LifestyleManualRow[];
  adaptationTarget: AdaptationTarget;
}): GeneratedSession | null {
  if (params.rows.length === 0) return null;
  const domain = inferDomainFromSport(params.sport);
  const targetSystem = targetSystemForLifestyleAdaptation(params.adaptationTarget);
  const summary = summarizeLifestyleRows(params.rows);
  const blocks: SessionBlock[] = params.rows.map((row, i) => {
    const dm = estimateLifestyleRowDurationMinutes(row);
    const cue = formatPro2LifestyleRowCue(row);
    const notes = row.notes.trim() ? ` | ${row.notes.trim()}` : "";
    const exId = row.playbookItemId.trim() ? [`playbook:${row.playbookItemId.trim()}`] : [];
    return {
      order: i + 1,
      label: row.name,
      method: "flow_recovery",
      targetSystem,
      durationMinutes: Math.max(1, dm),
      intensityCue: `${cue}${notes}`.slice(0, 500),
      expectedAdaptation: params.adaptationTarget,
      exerciseIds: exId,
    };
  });

  return {
    sport: params.sport,
    domain,
    goalLabel: "manual_coach_lifestyle_scheda",
    physiologicalTarget: params.adaptationTarget,
    expectedLoad: {
      loadBand: "low",
      tssHint: Math.max(10, summary.tss),
    },
    blocks,
    rationale: [
      "Builder manuale Pro 2 · scheda lifestyle (yoga, pilates, respiro, mobilità): stessa struttura a righe della scheda Gym, dominio mind_body.",
    ],
  };
}

export function buildPro2LifestyleSchedaSessionContract(input: {
  rows: Pro2LifestyleManualRow[];
  renderProfile: Pro2RenderProfile;
  discipline: string;
  sessionName: string;
  adaptationTarget?: string;
  phase?: string;
  plannedSessionDurationMinutes?: number;
}): Pro2BuilderSessionContract {
  const summary = summarizeLifestyleRows(input.rows);
  const blocks = input.rows.map((row) => {
    const dm = estimateLifestyleRowDurationMinutes(row);
    const cue = formatPro2LifestyleRowCue(row);
    const rpe = row.rpe ?? null;
    const chainRaw = (row.chainLabel ?? "").trim();
    return {
      id: row.id,
      label: row.name,
      kind: "lifestyle_practice",
      durationMinutes: dm,
      intensityCue: cue,
      notes: row.notes.trim() || undefined,
      lifestyleRx: {
        playbookItemId: row.playbookItemId.trim() || undefined,
        practiceCategory: row.practiceCategory,
        rounds: row.rounds,
        holdOrReps: row.holdOrReps.trim() || undefined,
        restSec: row.restSec,
        rpe: rpe != null && rpe > 0 ? rpe : undefined,
        executionStyle: row.executionStyle.trim() || undefined,
        breathPattern: row.breathPattern.trim() || undefined,
        chainLabel: chainRaw || undefined,
        mediaUrl: row.mediaUrl?.trim() || undefined,
      },
    };
  });

  return {
    version: 1,
    source: "builder",
    family: "lifestyle",
    discipline: input.discipline.trim() || "Lifestyle",
    sessionName: input.sessionName.trim() || "Scheda lifestyle Pro 2",
    adaptationTarget: input.adaptationTarget,
    phase: input.phase,
    plannedSessionDurationMinutes:
      input.plannedSessionDurationMinutes != null && input.plannedSessionDurationMinutes > 0
        ? Math.round(input.plannedSessionDurationMinutes)
        : undefined,
    summary,
    renderProfile: input.renderProfile,
    blocks,
  };
}
