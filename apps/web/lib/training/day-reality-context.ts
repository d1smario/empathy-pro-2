type PlannedSessionInput = {
  id: string;
  title?: string | null;
  duration_minutes?: number | null;
  tss_target?: number | null;
  kcal_target?: number | null;
};

type ExecutedSessionInput = {
  id: string;
  date?: string | null;
  duration_minutes?: number | null;
  tss?: number | null;
  kcal?: number | null;
  trace_summary?: Record<string, unknown> | null;
};

type EffectiveDaySession = {
  id: string;
  source: "planned" | "executed";
  title: string;
  durationMin: number;
  tss: number;
  kcal: number;
  avgPowerW: number | null;
};

export type EffectiveDayTrainingContext = {
  mode: "none" | "planned" | "executed";
  sessions: EffectiveDaySession[];
  summary: {
    hasPlannedSession: boolean;
    hasExecutedSession: boolean;
    totalDurationMin: number;
    totalTss: number;
    totalKcal: number;
    estimatedIntensityPctFtp: number;
    avgPowerW: number | null;
  };
};

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pickMetric(trace: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!trace) return null;
  for (const key of keys) {
    const value = asNum(trace[key]);
    if (value != null) return value;
  }
  return null;
}

function summarize(sessions: EffectiveDaySession[], hasPlannedSession: boolean, hasExecutedSession: boolean) {
  const totalDurationMin = sessions.reduce((sum, session) => sum + Math.max(0, session.durationMin), 0);
  const totalTss = sessions.reduce((sum, session) => sum + Math.max(0, session.tss), 0);
  const totalKcal = sessions.reduce((sum, session) => sum + Math.max(0, session.kcal), 0);
  const totalWeightedPower = sessions.reduce((sum, session) => {
    return sum + (session.avgPowerW != null ? session.avgPowerW * Math.max(1, session.durationMin) : 0);
  }, 0);
  const powerMinutes = sessions.reduce((sum, session) => sum + (session.avgPowerW != null ? Math.max(1, session.durationMin) : 0), 0);
  const avgPowerW = powerMinutes > 0 ? round(totalWeightedPower / powerMinutes) : null;
  const hours = Math.max(0.25, totalDurationMin / 60);
  const tssPerHour = totalTss / hours;
  const estimatedIntensityPctFtp = round(clamp(Math.sqrt(Math.max(0, tssPerHour) / 100) * 100, 55, 120), 1);

  return {
    hasPlannedSession,
    hasExecutedSession,
    totalDurationMin,
    totalTss,
    totalKcal,
    estimatedIntensityPctFtp,
    avgPowerW,
  };
}

export function buildEffectiveDayTrainingContext(input: {
  planned: PlannedSessionInput[];
  executed: ExecutedSessionInput[];
}): EffectiveDayTrainingContext {
  const plannedSessions: EffectiveDaySession[] = input.planned.map((session, index) => ({
    id: session.id,
    source: "planned",
    title: session.title ?? `Planned session ${index + 1}`,
    durationMin: Math.max(0, asNum(session.duration_minutes) ?? 0),
    tss: Math.max(0, asNum(session.tss_target) ?? 0),
    kcal: Math.max(0, asNum(session.kcal_target) ?? 0),
    avgPowerW: null,
  }));

  const executedSessions: EffectiveDaySession[] = input.executed.map((session, index) => ({
    id: session.id,
    source: "executed",
    title: `Executed session ${index + 1}`,
    durationMin: Math.max(0, asNum(session.duration_minutes) ?? 0),
    tss: Math.max(0, asNum(session.tss) ?? 0),
    kcal: Math.max(0, asNum(session.kcal) ?? 0),
    avgPowerW: pickMetric(session.trace_summary, ["power_avg_w", "power_avg", "avg_power", "powerAvg"]),
  }));

  if (executedSessions.length > 0) {
    return {
      mode: "executed",
      sessions: executedSessions,
      summary: summarize(executedSessions, plannedSessions.length > 0, true),
    };
  }

  if (plannedSessions.length > 0) {
    return {
      mode: "planned",
      sessions: plannedSessions,
      summary: summarize(plannedSessions, true, false),
    };
  }

  return {
    mode: "none",
    sessions: [],
    summary: {
      hasPlannedSession: false,
      hasExecutedSession: false,
      totalDurationMin: 0,
      totalTss: 0,
      totalKcal: 0,
      estimatedIntensityPctFtp: 55,
      avgPowerW: null,
    },
  };
}
