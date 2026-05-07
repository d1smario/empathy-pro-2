/** Giorno di calendario locale `YYYY-MM-DD` (diario atleta / URL operativi). */
export function localCalendarDayIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addCalendarDaysIso(dateIso: string, delta: number): string {
  const token = dateIso.slice(0, 10);
  const base = new Date(`${token}T12:00:00`);
  if (Number.isNaN(base.getTime())) return token;
  base.setDate(base.getDate() + delta);
  return localCalendarDayIso(base);
}
