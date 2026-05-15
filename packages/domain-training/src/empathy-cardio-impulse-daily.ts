/**
 * Impulso cardiovascolare Empathy da seduta (v0) — letteratura: stress cresce con durata e FC sopra soglia operativa.
 * Non è TRIMP né parity con metriche consumer; parametri versionabili e test golden.
 */
const DEFAULT_HR_FLOOR_BPM = 110;
const DEFAULT_STRESS_SCALE = 0.16;

export function empathyCardioImpulseDailyFromSession(input: {
  durationMinutes: number;
  hrAvgBpm: number | null;
  hrFloorBpm?: number;
  stressScale?: number;
}): number {
  const dur = Math.max(0, input.durationMinutes);
  const hr = input.hrAvgBpm;
  const floor = input.hrFloorBpm ?? DEFAULT_HR_FLOOR_BPM;
  const scale = input.stressScale ?? DEFAULT_STRESS_SCALE;
  if (hr == null || !Number.isFinite(hr)) return 0;
  return Math.max(0, hr - floor) * (dur / 60) * scale;
}
