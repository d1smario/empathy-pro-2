export type ExecutedSessionTimes = {
  started_at: string;
  ended_at: string;
};

function parseIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const ms = Date.parse(value.trim());
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function timesFromStartAndDuration(startIso: string, durationMinutes: number, endIso?: string | null): ExecutedSessionTimes {
  const startMs = Date.parse(startIso);
  if (endIso) {
    const endMs = Date.parse(endIso);
    if (Number.isFinite(endMs) && endMs > startMs) {
      return { started_at: startIso, ended_at: endIso };
    }
  }
  const dm = Math.max(1, Math.round(durationMinutes));
  return {
    started_at: startIso,
    ended_at: new Date(startMs + dm * 60 * 1000).toISOString(),
  };
}

/** WHOOP workout v2: `start` / `end` ISO; fallback da `duration_milli`. */
export function resolveWhoopWorkoutSessionTimes(
  rec: Record<string, unknown>,
  durationMinutes: number,
): ExecutedSessionTimes | null {
  const start = parseIsoTimestamp(rec.start);
  if (!start) return null;
  return timesFromStartAndDuration(start, durationMinutes, parseIsoTimestamp(rec.end));
}

/** Garmin activity summary: `startTimeInSeconds` UTC + `durationInSeconds`. */
export function resolveGarminActivitySessionTimes(rec: Record<string, unknown>): ExecutedSessionTimes | null {
  const sec = rec.startTimeInSeconds;
  if (typeof sec !== "number" || !Number.isFinite(sec)) {
    const gmt = parseIsoTimestamp(rec.startTimeGMT);
    if (!gmt) return null;
    const dur =
      typeof rec.durationInSeconds === "number" && rec.durationInSeconds > 0
        ? rec.durationInSeconds
        : typeof rec.duration === "number" && rec.duration > 0
          ? rec.duration
          : 3600;
    return timesFromStartAndDuration(gmt, Math.max(1, Math.round(dur / 60)));
  }
  const startMs = Math.trunc(sec) * 1000;
  const durSec =
    typeof rec.durationInSeconds === "number" && rec.durationInSeconds > 0
      ? rec.durationInSeconds
      : typeof rec.duration === "number" && rec.duration > 0
        ? rec.duration
        : null;
  const endMs = durSec != null ? startMs + durSec * 1000 : startMs + 3600 * 1000;
  return {
    started_at: new Date(startMs).toISOString(),
    ended_at: new Date(endMs).toISOString(),
  };
}

/** Strava activity: `start_date` / `start_date_local`. */
export function resolveStravaActivitySessionTimes(
  rec: Record<string, unknown>,
  durationMinutes: number,
): ExecutedSessionTimes | null {
  const start =
    parseIsoTimestamp(rec.start_date) ??
    parseIsoTimestamp(rec.start_date_local);
  if (!start) return null;
  return timesFromStartAndDuration(start, durationMinutes);
}

/**
 * Serie FC rappresentativa quando il vendor espone solo medie (es. WHOOP).
 * Non sostituisce campionamento reale; abilita curve training/bioenergetics su finestra oraria reale.
 */
export function buildScalarRepresentativeHrSeriesBpm(input: {
  durationMinutes: number;
  avgBpm: number;
  maxBpm?: number | null;
  maxPoints?: number;
}): number[] {
  const avg = input.avgBpm;
  if (!Number.isFinite(avg) || avg <= 0) return [];
  const dm = Math.max(1, Math.round(input.durationMinutes));
  const n = Math.max(2, Math.min(input.maxPoints ?? 120, dm));
  const series = Array.from({ length: n }, () => Math.round(avg));
  const max = input.maxBpm;
  if (max != null && Number.isFinite(max) && max > avg && n > 4) {
    series[Math.floor(n * 0.55)] = Math.round(max);
  }
  return series;
}
