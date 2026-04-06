export type ExecutedWorkoutLoadRow = {
  date: string | null;
  tss: number | null;
  duration_minutes: number | null;
  kcal?: number | null;
  trace_summary: Record<string, unknown> | null;
  lactate_mmoll: number | null;
  glucose_mmol: number | null;
  smo2: number | null;
};

export type DailyLoadPoint = {
  date: string;
  external: number;
  internal: number;
  ctl: number;
  atl: number;
  tsb: number;
  iCtl: number;
  iAtl: number;
  iTsb: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function asNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickMetric(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const key of keys) {
    const value = asNum(trace[key]);
    if (value != null) return value;
  }
  return null;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function internalLoadScore(row: ExecutedWorkoutLoadRow): number {
  const hrAvg = pickMetric(row.trace_summary, ["hr_avg_bpm", "avg_hr", "heart_rate_avg"]);
  const rpe = pickMetric(row.trace_summary, ["rpe", "session_rpe"]);
  const duration = Math.max(0, Number(row.duration_minutes ?? 0));
  const externalBase = Math.max(0, Number(row.tss ?? 0)) * 0.72;
  const hrStress = hrAvg != null ? Math.max(0, hrAvg - 110) * (duration / 60) * 0.16 : 0;
  const rpeStress = rpe != null ? rpe * (duration / 60) * 4.2 : 0;
  const lactateStress = row.lactate_mmoll != null ? Math.max(0, row.lactate_mmoll - 1.5) * 9 : 0;
  const glucosePenalty = row.glucose_mmol != null ? Math.abs(row.glucose_mmol - 5.2) * 4.4 : 0;
  const smo2Penalty = row.smo2 != null ? Math.max(0, 55 - row.smo2) * 1.05 : 0;
  return Math.max(0, externalBase + hrStress + rpeStress + lactateStress + glucosePenalty + smo2Penalty);
}

export function computeDailyLoadSeries(rows: ExecutedWorkoutLoadRow[]): DailyLoadPoint[] {
  const sorted = [...rows]
    .filter((row): row is ExecutedWorkoutLoadRow & { date: string } => typeof row.date === "string" && row.date.length >= 10)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!sorted.length) return [];

  const start = new Date(sorted[0].date + "T00:00:00");
  const end = new Date(sorted[sorted.length - 1].date + "T00:00:00");
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS));

  const byDay = new Map<string, { external: number; internal: number }>();
  for (const row of sorted) {
    const prev = byDay.get(row.date) ?? { external: 0, internal: 0 };
    byDay.set(row.date, {
      external: prev.external + Math.max(0, Number(row.tss ?? 0)),
      internal: prev.internal + internalLoadScore(row),
    });
  }

  const ATL_K = Math.exp(-1 / 7);
  const CTL_K = Math.exp(-1 / 42);
  let atl = 0;
  let ctl = 0;
  let iAtl = 0;
  let iCtl = 0;
  const out: DailyLoadPoint[] = [];

  for (let index = 0; index <= days; index += 1) {
    const day = new Date(start.getTime() + index * DAY_MS);
    const date = toDateOnly(day);
    const daily = byDay.get(date) ?? { external: 0, internal: 0 };
    atl = atl * ATL_K + daily.external * (1 - ATL_K);
    ctl = ctl * CTL_K + daily.external * (1 - CTL_K);
    iAtl = iAtl * ATL_K + daily.internal * (1 - ATL_K);
    iCtl = iCtl * CTL_K + daily.internal * (1 - CTL_K);
    out.push({
      date,
      external: daily.external,
      internal: daily.internal,
      ctl,
      atl,
      tsb: ctl - atl,
      iCtl,
      iAtl,
      iTsb: iCtl - iAtl,
    });
  }

  return out;
}
