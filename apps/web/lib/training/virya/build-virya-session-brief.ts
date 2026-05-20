import type { ViryaMicrocycleSlotPlan } from "@/lib/training/virya/virya-microcycle-planner";
import type {
  ViryaBuilderSessionBrief,
  ViryaMacroPhase,
  ViryaSportFamily,
  ViryaWeekdayPatternId,
} from "@/lib/training/virya/virya-builder-session-brief";

export function buildViryaBuilderSessionBrief(input: {
  weekStart: string;
  slot: ViryaMicrocycleSlotPlan;
  sessionsInWeek: number;
  weeklyBudgetLoad: number;
  weekdayPatternId: ViryaWeekdayPatternId;
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
}): ViryaBuilderSessionBrief {
  return {
    version: 1,
    weekStart: input.weekStart,
    weekdayOffset: input.slot.weekdayOffset,
    slotIndex: input.slot.slotIndex,
    sessionsInWeek: input.sessionsInWeek,
    weeklyBudgetLoad: input.weeklyBudgetLoad,
    loadTarget: input.slot.loadTarget,
    sessionRole: input.slot.sessionRole,
    phase: input.phase,
    family: input.family,
    discipline: input.discipline,
    planName: input.planName,
    phaseLabel: input.phaseLabel,
    sessionName: input.sessionName,
    objective: input.objective,
    methodology: input.methodology,
    weekObjectives: input.weekObjectives,
    gymPrimaryGoal: input.gymPrimaryGoal,
    contextHint: input.contextHint,
    weekdayPatternId: input.weekdayPatternId,
  };
}
