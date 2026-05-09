import type { BioenergeticSeriesPoint } from "@/api/bioenergetics/contracts";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function glucosePointsFromPayload(payload: Record<string, unknown>, createdAt: string | null): BioenergeticSeriesPoint[] {
  const out: BioenergeticSeriesPoint[] = [];
  const arrayKeys = ["samples", "data", "points", "readings"];
  for (const key of arrayKeys) {
    const arr = payload[key];
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      const rec = asRecord(row);
      if (!rec) continue;
      const value = num(rec.glucose_mmol ?? rec.glucoseMmol ?? rec.glucose ?? rec.value);
      if (value == null) continue;
      const tsRaw = typeof rec.ts === "string" ? rec.ts : typeof rec.timestamp === "string" ? rec.timestamp : createdAt;
      const ts = typeof tsRaw === "string" ? tsRaw : createdAt;
      if (!ts) continue;
      out.push({ ts, value, source: "cgm_export" });
    }
  }
  if (out.length) return out;

  const flatValue = num(payload.glucose_mmol ?? payload.glucoseMmol ?? payload.glucose ?? payload.value);
  if (flatValue != null && createdAt) {
    out.push({ ts: createdAt, value: flatValue, source: "cgm_export" });
  }
  return out;
}

export function lactatePointsFromPayload(payload: Record<string, unknown>, createdAt: string | null): BioenergeticSeriesPoint[] {
  const out: BioenergeticSeriesPoint[] = [];
  const value = num(payload.lactate_mmoll ?? payload.lactateMmolL ?? payload.lactate);
  if (value != null && createdAt) out.push({ ts: createdAt, value, source: "device_export" });
  return out;
}
