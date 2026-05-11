/** Evento timeline minimo per finestre pasto/seduta (compatibile con payload web). */
export type SimTimelineEventV1 = {
  ts: string;
  type: string;
  payload?: Record<string, unknown>;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function hourFromIsoTs(ts: string): number | null {
  const m = ts.match(/T(\d{2}):/);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
}

/**
 * Pesi decadimento post-prandiale da indice glicemico (0–100): IG alto → picco più stretto;
 * IG basso → coda più lunga (stesso carico CHO, forma diversa — allineato a meal plan / diario).
 */
export function mealPostprandialDecayWeightsForGi(glycemicIndex01: number): number[] {
  const gi = clamp(glycemicIndex01, 28, 95);
  const rapidity = clamp((gi - 38) / 50, 0, 1);
  if (rapidity >= 0.52) {
    const u = (rapidity - 0.52) / 0.48;
    return [0.88 + 0.26 * u, 0.4 - 0.1 * u, 0.18 - 0.07 * u];
  }
  const u = rapidity / 0.52;
  const spread = [
    0.48 + 0.28 * u,
    0.38 + 0.12 * u,
    0.26 + 0.06 * u,
    0.12 + 0.06 * u,
  ];
  return spread;
}

function mealGlycemicIndexFromPayload(payload: Record<string, unknown> | undefined): number {
  if (!payload) return 52;
  const raw = payload.glycemicIndex;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0 && raw <= 100) return raw;
  return 52;
}

/**
 * Peso 0–~2.8 per ogni ora: pasti con CHO/kcal modesti generano bump post-prandiale.
 * Modulato da **indice glicemico** nel payload pasto (`glycemicIndex` 1–100) quando presente;
 * default 52 se assente. Deterministico, auditabile (stesso timeline → stessa curva).
 */
export function mealGlycemicHourWeights24(timeline: readonly SimTimelineEventV1[]): number[] {
  const w = Array.from({ length: 24 }, () => 0);
  for (const ev of timeline) {
    if (ev.type !== "meal") continue;
    const carbsRaw = ev.payload?.carbsG;
    const kcalRaw = ev.payload?.kcal;
    const carbs = typeof carbsRaw === "number" && Number.isFinite(carbsRaw) ? Math.max(0, carbsRaw) : 0;
    const kcal = typeof kcalRaw === "number" && Number.isFinite(kcalRaw) ? Math.max(0, kcalRaw) : 0;
    if (carbs < 3.5 && kcal < 40) continue;
    const h = hourFromIsoTs(ev.ts);
    if (h == null) continue;
    const gi = mealGlycemicIndexFromPayload(ev.payload);
    const rapidity = clamp((gi - 38) / 52, 0, 1);
    const score0 = Math.min(1.35, carbs * 0.011 + kcal * 0.0016);
    const score = score0 * (0.9 + 0.22 * rapidity);
    const decays = mealPostprandialDecayWeightsForGi(gi);
    for (let t = 0; t < decays.length; t += 1) {
      const dw = decays[t];
      if (dw == null || !Number.isFinite(dw)) continue;
      w[(h + t) % 24] += score * dw;
    }
  }
  return w.map((x) => Math.min(x, 2.9));
}

/** Ore con effetto pasto rilevante (pathway / tile coerenti con la sim). */
export function mealInhibitoryHours(timeline: readonly SimTimelineEventV1[]): Set<number> {
  const w = mealGlycemicHourWeights24(timeline);
  const s = new Set<number>();
  for (let h = 0; h < 24; h += 1) {
    if (w[h] > 0.09) s.add(h);
  }
  return s;
}

/**
 * Ore occupate da allenamento (pianificato o eseguito): ora di inizio reale + span da `durationMinutes`
 * + transizione h-1. Sostituisce la finestra fissa ±2 ore quando la durata è nota.
 */
export function activitySupportHours(timeline: readonly SimTimelineEventV1[]): Set<number> {
  const s = new Set<number>();
  for (const ev of timeline) {
    if (ev.type !== "executed_session" && ev.type !== "planned_session") continue;
    const h = hourFromIsoTs(ev.ts);
    if (h == null) continue;
    const rawDur = ev.payload?.durationMinutes;
    let durNum: number | null = null;
    if (typeof rawDur === "number" && Number.isFinite(rawDur)) durNum = rawDur;
    else if (typeof rawDur === "string" && rawDur.trim()) {
      const n = Number(rawDur);
      if (Number.isFinite(n)) durNum = n;
    }
    const safeDur = durNum != null && durNum > 0 ? Math.max(20, durNum) : 60;
    const span = Math.min(10, Math.max(1, Math.ceil(safeDur / 60)));
    s.add((h - 1 + 24) % 24);
    for (let k = 0; k < span; k += 1) {
      s.add((h + k) % 24);
    }
  }
  return s;
}
