/**
 * Daycode Wahoo: giorni da 2020-01-01 UTC (il 1° gen 2020 ha daycode 1).
 * @see https://cloud-api.wahooligan.com/ — sezione Workouts / What is a daycode?
 */
const WAHOO_DAYCODE_EPOCH_UTC_MS = Date.UTC(2020, 0, 1);

export function wahooDayCodeFromUtcDate(isoDate: string): number {
  const d = isoDate.trim().slice(0, 10);
  const t = Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  if (!Number.isFinite(t)) throw new Error("wahoo_daycode_invalid_date");
  const days = Math.floor((t - WAHOO_DAYCODE_EPOCH_UTC_MS) / 86_400_000);
  return days + 1;
}
