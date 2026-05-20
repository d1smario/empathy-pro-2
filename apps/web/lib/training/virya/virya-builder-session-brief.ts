/**
 * Contratto per-seduta: tutte le decisioni VIRYA microciclo → istruzioni Builder.
 */

export type ViryaMacroPhase = "base" | "build" | "refine" | "peak" | "deload" | "second_peak";

export type ViryaSportFamily = "aerobic" | "strength" | "technical" | "lifestyle";

export type ViryaSessionRole = "quality" | "volume" | "recovery";

export type ViryaWeekdayPatternId = "3d" | "4d" | "5d" | "6d";

export type ViryaBuilderSessionBrief = {
  version: 1;
  weekStart: string;
  /** 0 = lunedì … 6 = domenica (allineato a weekStart locale) */
  weekdayOffset: number;
  slotIndex: number;
  sessionsInWeek: number;
  weeklyBudgetLoad: number;
  loadTarget: number;
  sessionRole: ViryaSessionRole;
  phase: ViryaMacroPhase;
  family: ViryaSportFamily;
  discipline: string;
  planName: string;
  phaseLabel: string;
  sessionName: string;
  objective?: string;
  methodology?: string;
  weekObjectives?: string[];
  gymPrimaryGoal?: string;
  contextHint?: string;
  weekdayPatternId: ViryaWeekdayPatternId;
};
