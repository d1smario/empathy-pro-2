/**
 * Parsing risposte collection WHOOP (v2): `records` + `next_token` / `nextToken`.
 * @see https://developer.whoop.com/docs/developing/pagination
 */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function extractWhoopListRecords(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  const o = asRecord(body);
  if (!o) return [];
  for (const key of ["records", "data", "items"] as const) {
    const arr = o[key];
    if (Array.isArray(arr)) return arr as Record<string, unknown>[];
  }
  return [];
}

/** Token pagina successiva; stringa vuota = nessuna pagina. */
export function extractWhoopNextToken(body: unknown): string | null {
  const o = asRecord(body);
  if (!o) return null;
  const raw = o.next_token ?? o.nextToken;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export function whoopRecordPrimaryId(rec: Record<string, unknown>): string | null {
  const id = rec.id;
  if (typeof id === "string" && id.trim()) return id.trim();
  if (typeof id === "number" && Number.isFinite(id)) return String(Math.trunc(id));
  return null;
}

/** Deduplica per id (paginazione sovrapposta o retry). */
export function dedupeWhoopRecordsById(records: Record<string, unknown>[]): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const r of records) {
    const id = whoopRecordPrimaryId(r);
    if (id) map.set(id, r);
  }
  return [...map.values()];
}
