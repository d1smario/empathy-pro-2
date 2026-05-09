/**
 * Giorno ISO (UTC) del campione wellness Garmin da un singolo oggetto summary (dailies/sleeps/hrv/stressDetails/bodyComps/…).
 * Garmin varia casing (`calendarDate` vs `CalendarDate`) e talvolta usa intero YYYYMMDD.
 * Body composition / blood pressure: spesso solo `measurementTimeInSeconds` (UTC sec).
 */

function firstFiniteNumber(...vals: unknown[]): number | null {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

export function isoDayFromGarminYyyyMmDdInt(raw: unknown): string | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const n = Math.trunc(raw);
  if (n < 19_000_101 || n > 29_991_231) return null;
  const s = String(n).padStart(8, "0");
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/** Allinea lettura wellness day tra materializzazione pull e pannello giornaliero. */
export function parseGarminWellnessLogicalDay(rec: Record<string, unknown>): string | null {
  const calRaw =
    rec.calendarDate ??
    rec.CalendarDate ??
    rec.calendar_date ??
    rec.Calendar_Date ??
    rec.date ??
    rec.Date;

  if (typeof calRaw === "string" && /^\d{4}-\d{2}-\d{2}/.test(calRaw.trim())) {
    return calRaw.trim().slice(0, 10);
  }
  const fromInt = isoDayFromGarminYyyyMmDdInt(calRaw);
  if (fromInt) return fromInt;

  const sts = firstFiniteNumber(
    rec.startTimeInSeconds,
    rec.StartTimeInSeconds,
    /** Body composition, blood pressure: momento della misura (UTC sec). */
    rec.measurementTimeInSeconds,
    rec.MeasurementTimeInSeconds,
  );
  if (sts != null) {
    return new Date(Math.trunc(sts) * 1000).toISOString().slice(0, 10);
  }

  const gmtStrRaw =
    rec.startTimeGMT ?? rec.StartTimeGMT ?? rec.startTimeGmt ?? rec.StartTimeGmt ?? rec.sleepStartTimestampGMT ?? rec.SleepStartTimestampGMT;
  if (typeof gmtStrRaw === "string" && gmtStrRaw.trim().length >= 8) {
    const d = new Date(gmtStrRaw.trim());
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  const gmtEpoch = firstFiniteNumber(
    rec.startTimestampGMT,
    rec.StartTimestampGMT,
    rec.startTimestampGmt,
    rec.sleepStartTimestampGMT,
    rec.SleepStartTimestampGMT,
    rec.sleepEndTimestampGMT,
    rec.SleepEndTimestampGMT,
  );
  if (gmtEpoch != null) {
    const ms = gmtEpoch > 10_000_000_000 ? Math.trunc(gmtEpoch) : Math.trunc(gmtEpoch) * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  return null;
}
