/** Allineato a V1 `TrainingBuilderPageView` — 7 zone + LT1 / LT2 / FatMax. */

export const PRO2_INTENSITY_OPTIONS = [
  "Z1",
  "Z2",
  "Z3",
  "Z4",
  "Z5",
  "Z6",
  "Z7",
  "LT1",
  "LT2",
  "FatMax",
] as const;

export type Pro2IntensityLabel = (typeof PRO2_INTENSITY_OPTIONS)[number];

export type Pro2IntensityUnit = "watt" | "hr";

export function intensityScore(intensity: string): number {
  const map: Record<string, number> = {
    Z1: 1,
    Z2: 2,
    Z3: 3,
    Z4: 4,
    Z5: 5,
    Z6: 6,
    Z7: 7,
    LT1: 3,
    LT2: 4,
    FatMax: 2,
  };
  return map[intensity] ?? 3;
}

export function colorForIntensity(intensity: string): string {
  const map: Record<string, string> = {
    Z1: "#00c2ff",
    Z2: "#00e08d",
    Z3: "#b6ff35",
    Z4: "#ffd60a",
    Z5: "#ff9e00",
    Z6: "#ff5d5d",
    Z7: "#ff00a8",
    LT1: "#61f4ff",
    LT2: "#ffd60a",
    FatMax: "#8affd1",
  };
  return map[intensity] ?? "#00e08d";
}

export function intensityToRelativeLoad(intensity: string): number {
  const map: Record<string, number> = {
    Z1: 0.55,
    Z2: 0.68,
    Z3: 0.8,
    Z4: 0.92,
    Z5: 1.02,
    Z6: 1.1,
    Z7: 1.2,
    LT1: 0.79,
    LT2: 0.95,
    FatMax: 0.65,
  };
  return map[intensity] ?? 0.8;
}

/** Fascia FTP/HR normalizzata (0–1) per etichetta zona Pro2 — usata anche da export Wahoo plan.json. */
export function zoneRelativeRange(intensity: string): { min: number; max: number } {
  const map: Record<string, { min: number; max: number }> = {
    Z1: { min: 0.5, max: 0.62 },
    Z2: { min: 0.63, max: 0.74 },
    Z3: { min: 0.75, max: 0.86 },
    Z4: { min: 0.87, max: 0.98 },
    Z5: { min: 0.99, max: 1.07 },
    Z6: { min: 1.08, max: 1.14 },
    Z7: { min: 1.15, max: 1.28 },
    LT1: { min: 0.76, max: 0.82 },
    LT2: { min: 0.92, max: 0.99 },
    FatMax: { min: 0.6, max: 0.7 },
  };
  return map[intensity] ?? { min: 0.75, max: 0.86 };
}

export function zoneRangeLabel(intensity: string, unit: Pro2IntensityUnit, ftpW: number, hrMax: number): string {
  const range = zoneRelativeRange(intensity);
  const ftp = Math.max(1, ftpW);
  const hr = Math.max(1, hrMax);
  if (unit === "watt") {
    const lo = Math.max(1, Math.round(ftp * range.min));
    const hi = Math.max(lo, Math.round(ftp * range.max));
    return `${intensity} ${lo}–${hi} W`;
  }
  const lo = Math.max(1, Math.round(hr * Math.min(range.min, 1.02)));
  const hi = Math.max(lo, Math.round(hr * Math.min(range.max, 1.02)));
  return `${intensity} ${lo}–${hi} bpm`;
}

export function zoneFromIntensityCue(cue: string, fallback: string = "Z2"): string {
  const text = cue.toUpperCase();
  if (text.includes("FATMAX") || text.includes("FAT MAX")) return "FatMax";
  if (text.includes("LT2")) return "LT2";
  if (text.includes("LT1")) return "LT1";
  if (text.includes("Z7")) return "Z7";
  if (text.includes("Z6")) return "Z6";
  if (text.includes("Z5")) return "Z5";
  if (text.includes("Z4")) return "Z4";
  if (text.includes("Z3")) return "Z3";
  if (text.includes("Z2")) return "Z2";
  if (text.includes("Z1")) return "Z1";
  if (text.includes("RECOVERY") || text.includes("LOW INTENSITY") || text.includes("BREATHING")) return "Z1";
  if (text.includes("EXPLOSIVE") || text.includes("POWER")) return "Z5";
  if (text.includes("THRESHOLD")) return "LT2";
  return fallback;
}

export function zoneForTargetValue(value: number, unit: Pro2IntensityUnit, ftpW: number, hrMax: number): string {
  const rel = unit === "watt" ? value / Math.max(1, ftpW) : value / Math.max(1, hrMax);
  if (rel < 0.6) return "Z1";
  if (rel < 0.74) return "Z2";
  if (rel < 0.86) return "Z3";
  if (rel < 0.98) return "Z4";
  if (rel < 1.08) return "Z5";
  if (rel < 1.15) return "Z6";
  return "Z7";
}

export function isPro2IntensityLabel(s: string): s is Pro2IntensityLabel {
  return (PRO2_INTENSITY_OPTIONS as readonly string[]).includes(s);
}

export function clampIntensityLabel(s: string): Pro2IntensityLabel {
  return isPro2IntensityLabel(s) ? s : "Z2";
}
