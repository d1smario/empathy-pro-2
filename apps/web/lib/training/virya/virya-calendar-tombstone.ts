/** Evita che un piano VIRYA eliminato riappaia in UI se il DB non era ancora allineato (refresh / tab VIRYA). */

const PREFIX = "empathy_virya_tombstone_";

export type ViryaCalendarTombstone = {
  tag: string;
  deletedAt: string;
};

function storageKey(athleteId: string): string {
  return `${PREFIX}${athleteId.trim()}`;
}

export function readViryaCalendarTombstones(athleteId: string): ViryaCalendarTombstone[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(athleteId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ViryaCalendarTombstone[];
    return Array.isArray(parsed) ? parsed.filter((t) => t.tag?.startsWith("[VIRYA:")) : [];
  } catch {
    return [];
  }
}

export function writeViryaCalendarTombstone(athleteId: string, tag: string): void {
  if (typeof window === "undefined" || !tag.trim().startsWith("[VIRYA:")) return;
  const key = storageKey(athleteId);
  const existing = readViryaCalendarTombstones(athleteId).filter((t) => t.tag !== tag);
  existing.push({ tag: tag.trim(), deletedAt: new Date().toISOString() });
  const trimmed = existing.slice(-12);
  try {
    window.localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {
    /* quota */
  }
}

export function clearViryaCalendarTombstone(athleteId: string, tag: string): void {
  if (typeof window === "undefined") return;
  const next = readViryaCalendarTombstones(athleteId).filter((t) => t.tag !== tag);
  try {
    if (next.length) window.localStorage.setItem(storageKey(athleteId), JSON.stringify(next));
    else window.localStorage.removeItem(storageKey(athleteId));
  } catch {
    /* ignore */
  }
}

/** Tombstone più vecchi di 7 giorni non vengono più riconciliati. */
export function activeViryaCalendarTombstones(athleteId: string): ViryaCalendarTombstone[] {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return readViryaCalendarTombstones(athleteId).filter((t) => {
    const ts = Date.parse(t.deletedAt);
    return Number.isFinite(ts) && ts >= cutoff;
  });
}
