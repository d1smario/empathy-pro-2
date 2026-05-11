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

/** Minuti da mezzanotte (0–1439) da timestamp locale `YYYY-MM-DDTHH:MM(:SS)?`. */
export function minutesFromMidnightLocalTs(ts: string): number | null {
  const m = ts.match(/T(\d{2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function sessionDurationMinutes(ev: SimTimelineEventV1): number {
  const rawDur = ev.payload?.durationMinutes;
  let durNum: number | null = null;
  if (typeof rawDur === "number" && Number.isFinite(rawDur)) durNum = rawDur;
  else if (typeof rawDur === "string" && rawDur.trim()) {
    const n = Number(rawDur);
    if (Number.isFinite(n)) durNum = n;
  }
  return durNum != null && durNum > 0 ? Math.max(20, durNum) : 60;
}

function overlapMinutes(a0: number, a1: number, b0: number, b1: number): number {
  const lo = Math.max(a0, b0);
  const hi = Math.min(a1, b1);
  return Math.max(0, hi - lo);
}

/**
 * Intensità allenamento 0–1 per ogni step (5 o 10 min): finestra reale start+durata,
 * ramp leggera primi 18 min, plateau, discesa ultimi 12 min.
 */
export function activityStepIntensity01V2(
  steps: number,
  stepMinutes: 5 | 10,
  timeline: readonly SimTimelineEventV1[],
): number[] {
  const out = Array.from({ length: steps }, () => 0);

  for (const ev of timeline) {
    if (ev.type !== "executed_session" && ev.type !== "planned_session") continue;
    const start = minutesFromMidnightLocalTs(ev.ts);
    if (start == null) continue;
    const dur = sessionDurationMinutes(ev);
    const end = start + dur;

    for (let i = 0; i < steps; i += 1) {
      const t0 = i * stepMinutes;
      const t1 = t0 + stepMinutes;
      const om = overlapMinutes(t0, t1, start, end);
      if (om <= 0) continue;
      const relStart = (t0 + t1) / 2 - start;
      const rampUp = Math.min(1, relStart / 18);
      const relEnd = end - (t0 + t1) / 2;
      const rampDn = Math.min(1, relEnd / 12);
      const shape = rampUp * rampDn;
      const frac = Math.min(1, om / stepMinutes);
      out[i] = Math.min(1, out[i] + frac * (0.28 + 0.72 * shape));
    }
  }

  for (let i = 0; i < steps; i += 1) {
    out[i] = Math.round(1000 * Math.min(1, out[i])) / 1000;
  }
  return out;
}

/**
 * Impulso post-prandiale per step (stesso giorno): centrato sull’orario pasto, forma da CHO/kcal e IG
 * (salita + decadimento esponenziale). Sostituisce l’interpolazione oraria nel sim sub-orario v2.
 */
export function mealGlycemicStepImpulseV2(
  steps: number,
  stepMinutes: 5 | 10,
  timeline: readonly SimTimelineEventV1[],
): number[] {
  const impulse = Array.from({ length: steps }, () => 0);
  const dayMin = 24 * 60;

  for (const ev of timeline) {
    if (ev.type !== "meal") continue;
    const center = minutesFromMidnightLocalTs(ev.ts);
    if (center == null) continue;
    const carbsRaw = ev.payload?.carbsG;
    const kcalRaw = ev.payload?.kcal;
    const carbs = typeof carbsRaw === "number" && Number.isFinite(carbsRaw) ? Math.max(0, carbsRaw) : 0;
    const kcal = typeof kcalRaw === "number" && Number.isFinite(kcalRaw) ? Math.max(0, kcalRaw) : 0;
    if (carbs < 3.5 && kcal < 40) continue;

    const gi = mealGlycemicIndexFromPayload(ev.payload);
    const rapidity = clamp((gi - 35) / 58, 0, 1);
    const choLoad = Math.min(2.35, carbs * 0.016 + kcal * 0.0024) * (0.88 + 0.2 * rapidity);
    const peakDelayMin = 20 + (1 - rapidity) * 42;
    const tailHalfLife = 44 + rapidity * 58;

    for (let i = 0; i < steps; i += 1) {
      const midMin = i * stepMinutes + stepMinutes / 2;
      let u = midMin - center;
      if (u < -720) u += dayMin;
      else if (u > 720) u -= dayMin;
      if (u < -stepMinutes || u > 360) continue;

      let w = 0;
      if (u <= peakDelayMin) {
        const ramp = (Math.max(0, u) / peakDelayMin) * choLoad;
        /* Evita w≈0 sullo step del pasto (solo rampa → sembrava «calo al morso»). */
        w = Math.max(choLoad * 0.11, ramp);
      } else w = choLoad * Math.exp(-(u - peakDelayMin) / tailHalfLife);
      impulse[i] += w;
    }
  }
  return impulse.map((x) => Math.min(x, 2.85));
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
