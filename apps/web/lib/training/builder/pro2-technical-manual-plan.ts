import { inferDomainFromSport } from "@/lib/training/engine/sport-translation";
import type {
  AdaptationTarget,
  GeneratedSession,
  PrimaryPhysiologySystem,
  SessionBlock,
  TechnicalModuleFocus,
} from "@/lib/training/engine/types";
import { estimateTssFromSegments } from "@/lib/training/builder/tss-estimate";
import { intensityScore } from "@/lib/training/builder/pro2-intensity";
import type { PlanChartSegment } from "@/lib/training/builder/manual-plan-block";
import type { Pro2BuilderSessionContract, Pro2RenderProfile } from "@/lib/training/builder/pro2-session-contract";

export type Pro2TechnicalManualRow = {
  id: string;
  entryType: "drill" | "scheme";
  playbookItemId: string;
  /** Chiave sport palette (es. soccer) per campo V1 + memoria visiva. */
  sportKeyForSchema: string;
  /**
   * Memoria asset: chiave stabile (`playbookItemId` o id riga) per future immagini esecuzione.
   * Oggi si usa schema SVG V1; raster → `visualSchemaKind` `raster_pending`.
   */
  visualAssetKey: string;
  visualSchemaKind: "v1_svg" | "raster_pending";
  name: string;
  durationMinutes: number;
  periodsLabel: string;
  spaceLabel: string;
  coachingCue: string;
  notes: string;
};

function newRowId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultPro2TechnicalManualRow(partial?: Partial<Pro2TechnicalManualRow>): Pro2TechnicalManualRow {
  const id = partial?.id ?? newRowId();
  return {
    id,
    entryType: partial?.entryType ?? "drill",
    playbookItemId: partial?.playbookItemId ?? "",
    sportKeyForSchema: partial?.sportKeyForSchema ?? "",
    visualAssetKey:
      (partial?.visualAssetKey && partial.visualAssetKey.trim()) ||
      (partial?.playbookItemId && partial.playbookItemId.trim()) ||
      id,
    visualSchemaKind: partial?.visualSchemaKind ?? "v1_svg",
    name: partial?.name ?? "Elemento piano",
    durationMinutes: Math.max(5, partial?.durationMinutes ?? 12),
    periodsLabel: partial?.periodsLabel ?? "",
    spaceLabel: partial?.spaceLabel ?? "",
    coachingCue: partial?.coachingCue ?? "",
    notes: partial?.notes ?? "",
  };
}

export function rowFromPlaybookEntry(entry: {
  id: string;
  sport: string;
  entryType: "drill" | "scheme";
  name: string;
  defaultMinutes: number;
  defaultPeriods: string;
  defaultSpace: string;
  defaultCue: string;
}): Pro2TechnicalManualRow {
  return defaultPro2TechnicalManualRow({
    entryType: entry.entryType,
    playbookItemId: entry.id,
    sportKeyForSchema: entry.sport,
    visualAssetKey: entry.id,
    visualSchemaKind: "v1_svg",
    name: entry.name,
    durationMinutes: entry.defaultMinutes,
    periodsLabel: entry.defaultPeriods,
    spaceLabel: entry.defaultSpace,
    coachingCue: entry.defaultCue,
  });
}

export function formatPro2TechnicalRowCue(row: Pro2TechnicalManualRow): string {
  const typeIt = row.entryType === "scheme" ? "Schema" : "Drill";
  const periods = row.periodsLabel.trim() ? ` · ${row.periodsLabel.trim()}` : "";
  const space = row.spaceLabel.trim() ? ` · ${row.spaceLabel.trim()}` : "";
  const cue = row.coachingCue.trim() ? ` · ${row.coachingCue.trim()}` : "";
  return `${typeIt}${periods}${space}${cue}`.trim();
}

function targetSystemForTechnicalAdaptation(adaptation: AdaptationTarget): PrimaryPhysiologySystem {
  if (adaptation === "skill_transfer") return "skill";
  if (adaptation === "power_output" || adaptation === "lactate_tolerance") return "coordination";
  if (adaptation === "recovery" || adaptation === "movement_quality") return "proprioception";
  return "coordination";
}

export function technicalManualRowsToChartSegments(rows: Pro2TechnicalManualRow[]): PlanChartSegment[] {
  let order = 1;
  const out: PlanChartSegment[] = [];
  for (const row of rows) {
    const dm = Math.max(clampRowDurationMinutes(row), 5);
    const sec = Math.max(120, dm * 60);
    out.push({
      id: row.id,
      order: order++,
      label: row.name,
      durationSeconds: sec,
      intensityLabel: "Z3",
      intensityScore: intensityScore("Z3"),
    });
  }
  return out;
}

function clampRowDurationMinutes(row: Pro2TechnicalManualRow): number {
  return Math.max(5, Math.min(45, Math.round(row.durationMinutes)));
}

function summarizeTechnicalRows(rows: Pro2TechnicalManualRow[]): Pro2BuilderSessionContract["summary"] {
  const segs = technicalManualRowsToChartSegments(rows);
  const durationSec = segs.reduce((s, x) => s + x.durationSeconds, 0);
  const tss = estimateTssFromSegments(segs);
  const kcal = Math.round(Math.max(0, tss) * 9.3);
  const avgPowerW = durationSec > 0 ? Math.round((130 * durationSec) / durationSec) : 0;
  return { durationSec, tss, kcal, kj: Math.round((avgPowerW * durationSec) / 1000), avgPowerW };
}

export function technicalManualRowsToGeneratedSession(params: {
  sport: string;
  rows: Pro2TechnicalManualRow[];
  adaptationTarget: AdaptationTarget;
}): GeneratedSession | null {
  if (params.rows.length === 0) return null;
  const domain = inferDomainFromSport(params.sport);
  const targetSystem = targetSystemForTechnicalAdaptation(params.adaptationTarget);
  const summary = summarizeTechnicalRows(params.rows);
  const blocks: SessionBlock[] = params.rows.map((row, i) => {
    const dm = clampRowDurationMinutes(row);
    const cue = formatPro2TechnicalRowCue(row);
    const notes = row.notes.trim() ? ` | ${row.notes.trim()}` : "";
    return {
      order: i + 1,
      label: row.name,
      method: "technical_drill",
      targetSystem,
      durationMinutes: dm,
      intensityCue: `${cue}${notes}`.slice(0, 500),
      expectedAdaptation: params.adaptationTarget,
      exerciseIds: row.playbookItemId.trim() ? [`playbook:${row.playbookItemId.trim()}`] : [],
    };
  });

  return {
    sport: params.sport,
    domain,
    goalLabel: "manual_coach_technical_scheda",
    physiologicalTarget: params.adaptationTarget,
    expectedLoad: {
      loadBand: "moderate",
      tssHint: Math.max(15, summary.tss),
    },
    blocks,
    rationale: [
      "Builder manuale Pro 2 · scheda sport tecnici (drill + schemi da playbook), parità logica con scheda Gym — TSS stimato vs carico interno post seduta.",
    ],
  };
}

export function buildPro2TechnicalSchedaSessionContract(input: {
  rows: Pro2TechnicalManualRow[];
  renderProfile: Pro2RenderProfile;
  discipline: string;
  sessionName: string;
  adaptationTarget?: string;
  phase?: string;
  plannedSessionDurationMinutes?: number;
  technicalModuleFocus?: TechnicalModuleFocus;
}): Pro2BuilderSessionContract {
  const summary = summarizeTechnicalRows(input.rows);
  const blocks = input.rows.map((row) => {
    const dm = clampRowDurationMinutes(row);
    const cue = formatPro2TechnicalRowCue(row);
    return {
      id: row.id,
      label: row.name,
      kind: row.entryType === "scheme" ? "technical_scheme" : "technical_drill",
      durationMinutes: dm,
      intensityCue: cue,
      notes: row.notes.trim() || undefined,
      technicalRx: {
        playbookItemId: row.playbookItemId.trim() || undefined,
        entryType: row.entryType,
        periodsLabel: row.periodsLabel.trim() || undefined,
        spaceLabel: row.spaceLabel.trim() || undefined,
        coachingCue: row.coachingCue.trim() || undefined,
        visualAssetKey: row.visualAssetKey.trim() || undefined,
        visualSchemaKind: row.visualSchemaKind,
        sportKeyForSchema: row.sportKeyForSchema.trim() || undefined,
      },
    };
  });

  return {
    version: 1,
    source: "builder",
    family: "technical",
    discipline: input.discipline.trim() || "Sport tecnico",
    sessionName: input.sessionName.trim() || "Scheda tecnica Pro 2",
    adaptationTarget: input.adaptationTarget,
    phase: input.phase,
    plannedSessionDurationMinutes:
      input.plannedSessionDurationMinutes != null && input.plannedSessionDurationMinutes > 0
        ? Math.round(input.plannedSessionDurationMinutes)
        : undefined,
    summary,
    renderProfile: input.renderProfile,
    blocks,
    technicalModuleFocus: input.technicalModuleFocus,
  };
}
