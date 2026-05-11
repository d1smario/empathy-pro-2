/** Limite inclusivo giorni per `GET …/bioenergetics/window` (carico DB / payload). */
export const BIOENERGETIC_WINDOW_MAX_DAYS = 14 as const;

function parseIsoDateUtcNoon(s: string): number {
  return new Date(`${s.slice(0, 10)}T12:00:00.000Z`).getTime();
}

function addDaysIsoDate(date: string, deltaDays: number): string {
  const base = new Date(`${date.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return date.slice(0, 10);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

function inclusiveDaySpan(start: string, end: string): number {
  const a = parseIsoDateUtcNoon(start);
  const b = parseIsoDateUtcNoon(end);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.floor((b - a) / 86400000) + 1;
}

/**
 * Elenco date ISO `YYYY-MM-DD` da `from` a `to` inclusi (ordinato).
 * `from` > `to` viene normalizzato scambiando gli estremi.
 */
export function enumerateInclusiveIsoDates(
  fromIso: string,
  toIso: string,
): { ok: true; dates: string[] } | { ok: false; error: string } {
  const from = fromIso.trim().slice(0, 10);
  const to = toIso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false, error: "invalid_date_range" };
  }
  let start = from;
  let end = to;
  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }
  const span = inclusiveDaySpan(start, end);
  if (!Number.isFinite(span) || span < 1) return { ok: false, error: "invalid_date_range" };
  if (span > BIOENERGETIC_WINDOW_MAX_DAYS) {
    return { ok: false, error: `window_max_${BIOENERGETIC_WINDOW_MAX_DAYS}_days` };
  }
  const dates: string[] = [];
  let cur = start;
  for (let i = 0; i < span; i += 1) {
    dates.push(cur);
    cur = addDaysIsoDate(cur, 1);
  }
  return { ok: true, dates };
}
