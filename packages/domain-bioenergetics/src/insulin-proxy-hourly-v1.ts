import type { SimDayKernelV1Input } from "./day-simulator-v1";
import { activitySupportHours, hourFromIsoTs } from "./sim-timeline-v1";
import type { SimTimelineEventV1 } from "./sim-timeline-v1";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Modulazione circadiana leggera sul proxy (notte più bassa, giorno più alta) — moltiplicatore ~0.55–1.0. */
function circadianInsulinMod(h: number): number {
  return 0.58 + 0.42 * (0.5 + 0.5 * Math.sin(((h - 14) * Math.PI) / 12));
}

/**
 * Domanda insulinica (proxy) 0–100 su 24 h: base dal kernel + pasti da timeline (CHO, insulin_load)
 * + attenuazione nelle ore con seduta (carico muscolo/assorbimento operativo).
 * Non è insulina ematica; è segnale operativo per incrociare diario e allenamento.
 */
export function buildInsulinProxyHourly24(
  kernel: SimDayKernelV1Input,
  timeline: readonly SimTimelineEventV1[],
): number[] {
  const base = clamp(kernel.insulinDemandScore, 0, 100);
  const actH = activitySupportHours(timeline);
  const hourly = Array.from({ length: 24 }, (_, h) => {
    let v = base * circadianInsulinMod(h);
    if (actH.has(h)) v *= 0.9;
    return v;
  });

  for (const ev of timeline) {
    if (ev.type !== "meal") continue;
    const mh = hourFromIsoTs(ev.ts);
    if (mh == null) continue;
    const carbs = (ev.payload?.carbsG as number | undefined) ?? 0;
    const insulinLoad = (ev.payload?.insulinLoad as number | undefined) ?? 0;
    const c = typeof carbs === "number" && Number.isFinite(carbs) ? Math.max(0, carbs) : 0;
    const il = typeof insulinLoad === "number" && Number.isFinite(insulinLoad) ? Math.max(0, insulinLoad) : 0;
    const mealPush = il * 0.9 + c * 0.14;
    if (mealPush <= 0) continue;
    const sigma = 2.35;
    for (let h = 0; h < 24; h += 1) {
      const d = Math.min(Math.abs(h - mh), Math.abs(h - mh + 24), Math.abs(h - mh - 24));
      const g = Math.exp(-(d * d) / (2 * sigma * sigma));
      hourly[h] += mealPush * g;
    }
  }

  return hourly.map((v) => Math.round(clamp(v, 0, 100) * 10) / 10);
}
