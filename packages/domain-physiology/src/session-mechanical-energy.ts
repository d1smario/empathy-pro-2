/** Rendimento meccanico grossolano — allineato a motori CP / multisport Pro 2. */
export const DEFAULT_MECHANICAL_EFFICIENCY = 0.24;

/** Carico relativo FTP per etichetta zona Pro 2 (mirror `pro2-intensity.ts`). */
const ZONE_RELATIVE_LOAD: Record<string, number> = {
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

/** Fascia FTP normalizzata per zona — midpoint usato per potenza meccanica (allineato ladder Builder). */
const ZONE_RELATIVE_RANGE: Record<string, { min: number; max: number }> = {
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

export function zoneRelativeLoadForLabel(intensity: string): number {
  return ZONE_RELATIVE_LOAD[intensity] ?? 0.8;
}

function normalizeZoneKey(intensity: string): string {
  const t = intensity.trim();
  if (/^fatmax$/i.test(t)) return "FatMax";
  if (/^LT1$/i.test(t)) return "LT1";
  if (/^LT2$/i.test(t)) return "LT2";
  const m = t.match(/\b(Z[1-7])\b/i);
  if (m) return m[1]!.toUpperCase();
  return t;
}

/** Potenza media stimata (W) = FTP × midpoint fascia zona. */
export function powerWattsForZoneLabel(intensity: string, ftpW: number): number {
  const ftp = Math.max(1, ftpW);
  const key = normalizeZoneKey(intensity);
  const range = ZONE_RELATIVE_RANGE[key];
  const rel = range ? (range.min + range.max) / 2 : zoneRelativeLoadForLabel(key);
  return Math.max(45, Math.round(ftp * rel));
}

export function mechanicalKjFromIntensitySegments(
  segments: ReadonlyArray<{ durationSeconds: number; intensityLabel: string }>,
  ftpW: number,
): number {
  const segs = segments.map((s) => ({
    powerW: powerWattsForZoneLabel(s.intensityLabel, ftpW),
    durationSeconds: s.durationSeconds,
  }));
  return mechanicalKjFromSegments(segs);
}

export function mechanicalJoulesFromSegments(segments: { powerW: number; durationSeconds: number }[]): number {
  return segments.reduce(
    (sum, seg) => sum + Math.max(0, seg.powerW) * Math.max(0, seg.durationSeconds),
    0,
  );
}

export function mechanicalKjFromSegments(segments: { powerW: number; durationSeconds: number }[]): number {
  return Math.round(mechanicalJoulesFromSegments(segments) / 1000);
}

export function mechanicalKjFromAvgPower(avgPowerW: number, durationSec: number): number {
  if (!Number.isFinite(avgPowerW) || !Number.isFinite(durationSec) || avgPowerW <= 0 || durationSec <= 0) {
    return 0;
  }
  return Math.round((avgPowerW * durationSec) / 1000);
}

/**
 * Energia metabolica da lavoro meccanico.
 * W_mech = Σ(P_i × t_i) → kJ = W_mech/1000 → kcal = (kJ / η) / 4.184
 * (η ≈ 0.24, come Physiology dashboard: `(avgW / η) × 3600 / 4184` kcal/h).
 */
export function metabolicKcalFromMechanicalKj(
  mechanicalKj: number,
  efficiency: number = DEFAULT_MECHANICAL_EFFICIENCY,
): number {
  if (!Number.isFinite(mechanicalKj) || mechanicalKj <= 0) return 0;
  const eta = Math.max(0.05, Math.min(0.5, efficiency));
  return Math.round(mechanicalKj / eta / 4.184);
}

export function metabolicKcalFromMechanicalWork(input: {
  mechanicalKj?: number | null;
  avgPowerW?: number | null;
  durationSec?: number | null;
  efficiency?: number;
}): number {
  const eta = input.efficiency ?? DEFAULT_MECHANICAL_EFFICIENCY;
  const kj =
    typeof input.mechanicalKj === "number" && input.mechanicalKj > 0
      ? input.mechanicalKj
      : mechanicalKjFromAvgPower(input.avgPowerW ?? 0, input.durationSec ?? 0);
  return metabolicKcalFromMechanicalKj(kj, eta);
}
