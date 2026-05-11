/**
 * Superficie visiva «CGM-like» (Libre / Supersapiens **consumer**): smoothing + rumore correlato,
 * tutto deterministico da giorno+kernel — **non** è misura device, non sostituisce ingest CGM.
 */

/** Allineato a `SimSeriesPointV1` / `SimDayKernelV1Input` (evita import circolare con day-simulator). */
export type CgmSurfaceSeriesPointV1 = { ts: string; value: number; source: string };
export type CgmSurfaceKernelV1Input = {
  insulinDemandScore: number;
  anabolicSuppressionScore: number;
  glucoseHandlingScore: number;
  oxidationDriveScore: number;
  pathwayState: "supportive" | "mixed" | "inhibitory";
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Seed 32 bit da stringa (stabile tra run). */
function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Passa basso leggero (bordi invariati) — morbidezza tipo curva ISF filtrata. */
function smoothInterior3Tap(values: readonly number[], passes: number): number[] {
  let cur = [...values];
  const n = cur.length;
  if (n < 3) return cur;
  for (let p = 0; p < passes; p += 1) {
    const next = [...cur];
    for (let i = 1; i < n - 1; i += 1) {
      next[i] = 0.22 * cur[i - 1]! + 0.56 * cur[i]! + 0.22 * cur[i + 1]!;
    }
    cur = next;
  }
  return cur;
}

function ar1CorrelatedNoise(length: number, rnd: () => number, rho: number, scale: number): number[] {
  const out: number[] = [];
  let z = 0;
  for (let i = 0; i < length; i += 1) {
    z = rho * z + (1 - rho) * (rnd() * 2 - 1);
    out.push(z * scale);
  }
  return out;
}

export type CgmSurfaceRealismClamp = { lo: number; hi: number };

/**
 * Applica morbidezza e micro-variazioni correlate nel tempo (stile traccia continua consumer),
 * poi riclampa. Stessi `ts` e `source` dei punti in ingresso.
 */
export function applyCgmLikeSurfaceToSubhourlyGluLac(input: {
  glucose: readonly CgmSurfaceSeriesPointV1[];
  lactate: readonly CgmSurfaceSeriesPointV1[];
  date: string;
  kernel: CgmSurfaceKernelV1Input;
  glucoseClamp: CgmSurfaceRealismClamp;
  lactateClamp: CgmSurfaceRealismClamp;
}): { glucose: CgmSurfaceSeriesPointV1[]; lactate: CgmSurfaceSeriesPointV1[] } {
  const { glucose, lactate, date, kernel, glucoseClamp, lactateClamp } = input;
  const seedStr = [
    date.slice(0, 10),
    kernel.pathwayState,
    kernel.insulinDemandScore,
    kernel.glucoseHandlingScore,
    kernel.oxidationDriveScore,
    kernel.anabolicSuppressionScore,
  ].join("|");
  const rnd = mulberry32(hash32(`cgm_surface_v1|${seedStr}`));

  const gv = glucose.map((p) => p.value);
  const lv = lactate.map((p) => p.value);
  const n = gv.length;
  if (n === 0 || lv.length !== n) {
    return { glucose: glucose.map((p) => ({ ...p })), lactate: lactate.map((p) => ({ ...p })) };
  }

  /* Un solo passaggio sul glucosio: meno appiattimento così pasti/alba restano più leggibili. */
  let gSm = smoothInterior3Tap(gv, 1);
  let lSm = smoothInterior3Tap(lv, 1);

  const gNoise = ar1CorrelatedNoise(n, rnd, 0.88, 0.045);
  const lNoise = ar1CorrelatedNoise(n, rnd, 0.84, 0.026);

  const stressHint = clamp(
    (kernel.insulinDemandScore + (100 - kernel.glucoseHandlingScore) * 0.35 + kernel.anabolicSuppressionScore * 0.25) /
      220,
    0,
    1,
  );
  const gNoiseScale = 0.72 + 0.38 * stressHint;

  const glucoseOut: CgmSurfaceSeriesPointV1[] = glucose.map((p, i) => {
    const hf = (i / Math.max(1, n - 1)) * 24;
    const ripple = 0.011 * Math.sin(hf * 9.1 + seedStr.length * 0.07);
    const v = clamp(gSm[i]! + gNoise[i]! * gNoiseScale + ripple, glucoseClamp.lo, glucoseClamp.hi);
    return { ts: p.ts, value: Math.round(v * 1000) / 1000, source: p.source };
  });

  const lactateOut: CgmSurfaceSeriesPointV1[] = lactate.map((p, i) => {
    const hf = (i / Math.max(1, n - 1)) * 24;
    const ripple = 0.006 * Math.sin(hf * 7.3 + 1.2);
    const v = clamp(lSm[i]! + lNoise[i]! + ripple, lactateClamp.lo, lactateClamp.hi);
    return { ts: p.ts, value: Math.round(v * 1000) / 1000, source: p.source };
  });

  return { glucose: glucoseOut, lactate: lactateOut };
}
