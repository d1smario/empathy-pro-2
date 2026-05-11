import type { AthleteTimeSeriesSampleRowV1 } from "@empathy/contracts";
import { ATHLETE_TIME_SERIES_CHANNEL_V1 } from "@empathy/contracts";

export type WindowStreamChannelStats = {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
};

export type WindowStreamStatsV1 = {
  glucose: WindowStreamChannelStats;
  lactate: WindowStreamChannelStats;
  totalSamples: number;
};

function emptyChannel(): WindowStreamChannelStats {
  return { count: 0, min: null, max: null, mean: null };
}

function finalize(values: number[]): WindowStreamChannelStats {
  if (!values.length) return emptyChannel();
  let min = values[0]!;
  let max = values[0]!;
  let sum = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { count: values.length, min, max, mean: sum / values.length };
}

/** Statistiche descrittive sui campioni tabella 055 (solo canali v1 noti). */
export function computeBioenergeticWindowStreamStats(samples: AthleteTimeSeriesSampleRowV1[]): WindowStreamStatsV1 {
  const gVals: number[] = [];
  const lVals: number[] = [];
  for (const s of samples) {
    if (!Number.isFinite(s.value)) continue;
    if (s.channel === ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L) gVals.push(s.value);
    else if (s.channel === ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L) lVals.push(s.value);
  }
  return {
    glucose: finalize(gVals),
    lactate: finalize(lVals),
    totalSamples: samples.length,
  };
}

/** Punti per grafico tempo: una riga per timestamp (merge stesso `observed_at`). */
export type WindowStreamChartRow = {
  tsMs: number;
  observedAt: string;
  glucoseMmolL: number | null;
  lactateMmolL: number | null;
};

/** Data calendario UTC `YYYY-MM-DD` da `observed_at` ISO (allineamento slice giorno). */
export function utcCalendarDateFromObservedAt(observedAt: string): string | null {
  const d = observedAt.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** Min / max / media / conteggio per canale su una giornata UTC. */
export type WindowStreamDailyRollupRow = {
  dateUtc: string;
  glucose: WindowStreamChannelStats;
  lactate: WindowStreamChannelStats;
};

export function buildBioenergeticWindowStreamDailyRollups(samples: AthleteTimeSeriesSampleRowV1[]): WindowStreamDailyRollupRow[] {
  const byDay = new Map<string, { g: number[]; l: number[] }>();
  for (const s of samples) {
    if (!Number.isFinite(s.value) || !s.observed_at) continue;
    const day = utcCalendarDateFromObservedAt(s.observed_at);
    if (!day) continue;
    const cur = byDay.get(day) ?? { g: [], l: [] };
    if (s.channel === ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L) cur.g.push(s.value);
    else if (s.channel === ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L) cur.l.push(s.value);
    byDay.set(day, cur);
  }
  const dates = [...byDay.keys()].sort();
  return dates.map((dateUtc) => {
    const v = byDay.get(dateUtc)!;
    return { dateUtc, glucose: finalize(v.g), lactate: finalize(v.l) };
  });
}

export type WindowStreamVariabilityV1 = {
  /** Media di (max−min) sui giorni con almeno 2 campioni nel canale (ampiezza intra-giorno). */
  glucoseMeanDailyRange: number | null;
  lactateMeanDailyRange: number | null;
  daysWithGlucoseGte2: number;
  daysWithLactateGte2: number;
};

export function computeBioenergeticWindowStreamVariability(daily: WindowStreamDailyRollupRow[]): WindowStreamVariabilityV1 {
  const gluRanges: number[] = [];
  const lacRanges: number[] = [];
  let daysWithGlucoseGte2 = 0;
  let daysWithLactateGte2 = 0;
  for (const row of daily) {
    if (row.glucose.count >= 2 && row.glucose.min != null && row.glucose.max != null) {
      gluRanges.push(row.glucose.max - row.glucose.min);
      daysWithGlucoseGte2 += 1;
    }
    if (row.lactate.count >= 2 && row.lactate.min != null && row.lactate.max != null) {
      lacRanges.push(row.lactate.max - row.lactate.min);
      daysWithLactateGte2 += 1;
    }
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    glucoseMeanDailyRange: mean(gluRanges),
    lactateMeanDailyRange: mean(lacRanges),
    daysWithGlucoseGte2,
    daysWithLactateGte2,
  };
}

export function buildBioenergeticWindowStreamChartRows(samples: AthleteTimeSeriesSampleRowV1[]): WindowStreamChartRow[] {
  const byTs = new Map<string, { glucose?: number; lactate?: number }>();
  for (const s of samples) {
    if (!Number.isFinite(s.value) || !s.observed_at) continue;
    const cur = byTs.get(s.observed_at) ?? {};
    if (s.channel === ATHLETE_TIME_SERIES_CHANNEL_V1.GLUCOSE_MMOL_L) cur.glucose = s.value;
    if (s.channel === ATHLETE_TIME_SERIES_CHANNEL_V1.LACTATE_MMOL_L) cur.lactate = s.value;
    byTs.set(s.observed_at, cur);
  }
  const rows: WindowStreamChartRow[] = [];
  for (const [observedAt, v] of byTs) {
    const tsMs = Date.parse(observedAt);
    if (!Number.isFinite(tsMs)) continue;
    rows.push({
      tsMs,
      observedAt,
      glucoseMmolL: v.glucose != null && Number.isFinite(v.glucose) ? v.glucose : null,
      lactateMmolL: v.lactate != null && Number.isFinite(v.lactate) ? v.lactate : null,
    });
  }
  rows.sort((a, b) => a.tsMs - b.tsMs);
  return rows;
}
