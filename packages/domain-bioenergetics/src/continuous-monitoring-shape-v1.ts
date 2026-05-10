/**
 * Forma oraria per «monitoraggio continuo» quando non esiste stream reale:
 * ripple leggero attorno a un valore di riferimento (stesso paradigma sostituibile da device).
 */
export function hourlyRippleRelative(base: number, hour: number, phaseHour: number, relAmp = 0.09): number {
  const v = base * (1 + relAmp * Math.sin(((hour - phaseHour) * Math.PI) / 12));
  if (!Number.isFinite(v)) return base;
  return Math.round(v * 1000) / 1000;
}

export function hourlyFlat24(base: number): number[] {
  const b = Math.round(base * 1000) / 1000;
  return Array.from({ length: 24 }, () => b);
}

export function hourlyRippleSeries24(base: number, phaseHour: number, relAmp = 0.09): number[] {
  return Array.from({ length: 24 }, (_, h) => hourlyRippleRelative(base, h, phaseHour, relAmp));
}
