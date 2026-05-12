/**
 * Id stabile Garmin per `external_id` (`garmin_api:…`) e per `activityFile?id=`.
 * Garmin a volte espone `summaryId` composito mentre `GET /rest/activityFile` accetta
 * l’`activityId` numerico: se preferiamo il summary prima, l’arricchimento FIT non trova la riga.
 */

export function pickGarminActivityStableId(r: Record<string, unknown>): string | null {
  for (const key of ["activityId", "activityID"] as const) {
    const v = r[key];
    if (typeof v === "number" && Number.isFinite(v)) return String(Math.trunc(v));
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return v.trim();
  }
  const s1 = r.summaryId ?? r.summaryID;
  if (typeof s1 === "string" && s1.trim()) return s1.trim();
  if (typeof s1 === "number" && Number.isFinite(s1)) return String(Math.trunc(s1));
  for (const key of ["activityId", "activityID"] as const) {
    const v = r[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
