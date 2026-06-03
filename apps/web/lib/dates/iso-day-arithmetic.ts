/**
 * Aritmetica su chiavi `YYYY-MM-DD` senza drift da `Date.parse` UTC vs locale.
 * Usare per VIRYA, calendario, nutrition — non `new Date(iso).toISOString().slice(0,10)`.
 */

export function normalizeIsoDayKey(value: string): string {
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : value.trim().slice(0, 10);
}

export function addIsoDays(isoDay: string, deltaDays: number): string {
  const key = normalizeIsoDayKey(isoDay);
  const base = new Date(`${key}T12:00:00`);
  if (Number.isNaN(base.getTime())) return key;
  base.setDate(base.getDate() + deltaDays);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Lunedì della settimana ISO locale che contiene `isoDay` (VIRYA weekdayOffset 0 = lun). */
export function mondayOfIsoWeek(isoDay: string): string {
  const key = normalizeIsoDayKey(isoDay);
  const base = new Date(`${key}T12:00:00`);
  if (Number.isNaN(base.getTime())) return key;
  const dow = base.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  return addIsoDays(key, delta);
}
