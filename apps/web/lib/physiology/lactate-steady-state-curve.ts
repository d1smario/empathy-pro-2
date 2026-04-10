/**
 * Blood lactate vs relative power (%FTP) — **smooth monotone** schematic curve (no blood draw).
 *
 * Literature shape (incremental / steady-state schematics, e.g. Brooks; Beneke MLSS reviews):
 * - Very gentle rise below LT1, then **curvilinear** (concavity changes), steepening toward LT2,
 *   then **asymptotic approach** to the MLSS band (~4–6 mmol/L) at FTP — not a polyline.
 * - Implementation: **PCHIP** (Fritsch–Carlson) through physiologically ordered knots so the plot
 *   matches textbook figures (smooth S-shaped segment, not straight segments).
 *
 * Peak lactate in maximal short efforts is separate (`estimatePeakBloodLactateMmol`).
 */

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** PCHIP slopes (monotone-preserving cubic Hermite). */
function pchipSlopes(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  if (n < 2) return [0];
  const h = xs.slice(1).map((xj, i) => xj - xs[i]!);
  const delta = h.map((hj, i) => (ys[i + 1]! - ys[i]!) / hj);
  const m = new Array<number>(n);
  m[0] = delta[0]!;
  m[n - 1] = delta[n - 2]!;
  for (let k = 1; k < n - 1; k++) {
    if (delta[k - 1] === 0 || delta[k] === 0 || delta[k - 1]! * delta[k]! < 0) {
      m[k] = 0;
    } else {
      const w1 = 2 * h[k]! + h[k - 1]!;
      const w2 = h[k]! + 2 * h[k - 1]!;
      m[k] = (w1 + w2) / (w1 / delta[k - 1]! + w2 / delta[k]!);
    }
  }
  if (n > 2) {
    m[0] = ((2 * h[0]! + h[1]!) * delta[0]! - h[0]! * delta[1]!) / (h[0]! + h[1]!);
    if (Math.sign(m[0]!) !== Math.sign(delta[0]!)) m[0] = 0;
    else if (Math.sign(delta[0]!) !== Math.sign(delta[1]!)) m[0] = 0;
    const kn = n - 2;
    m[n - 1] = ((2 * h[kn]! + h[kn - 1]!) * delta[kn]! - h[kn]! * delta[kn - 1]!) / (h[kn]! + h[kn - 1]!);
    if (Math.sign(m[n - 1]!) !== Math.sign(delta[kn]!)) m[n - 1] = 0;
    else if (Math.sign(delta[kn]!) !== Math.sign(delta[kn - 1]!)) m[n - 1] = 0;
  }
  return m;
}

function pchipEval(xs: number[], ys: number[], m: number[], x: number): number {
  const n = xs.length;
  if (n < 2) return ys[0] ?? 0;
  if (x <= xs[0]!) return ys[0]!;
  if (x >= xs[n - 1]!) return ys[n - 1]!;
  let k = 0;
  while (k < n - 1 && x > xs[k + 1]!) k++;
  const h = xs[k + 1]! - xs[k]!;
  const t = clamp((x - xs[k]!) / h, 0, 1);
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * ys[k]! + h10 * h * m[k]! + h01 * ys[k + 1]! + h11 * h * m[k + 1]!;
}

/** MLSS-band lactate at FTP; rises slightly as glycolytic proxy increases (canonical band ~0.3–0.8). */
function mlssPlateauMmol(vlamax: number): number {
  const vl = clamp(vlamax, 0.15, 1.6);
  const t = clamp((vl - 0.15) / 0.65, 0, 1);
  return clamp(4.32 + 0.62 * t, 4.15, 5.95);
}

function buildLactateKnots(lt1Pct: number, lt2Pct: number, vlamax: number): { xs: number[]; ys: number[] } {
  const lt1 = clamp(lt1Pct, 58, 90);
  const lt2 = clamp(lt2Pct, lt1 + 3, 99);
  const vl = clamp(vlamax, 0.15, 1.6);
  const Lftp = mlssPlateauMmol(vlamax);
  const vlT = clamp((vl - 0.15) / 0.65, 0, 1);

  const xMidLow = 60 + 0.38 * (lt1 - 60);
  const xMidLt = (lt1 + lt2) / 2;
  const y0 = clamp(1.02 + 0.18 * (1 - vlT), 0.98, 1.28);
  const yMidLow = y0 + 0.42 * (2.05 - y0);
  const ltSpread = clamp((lt2 - lt1) / 22, 0, 1);
  const yMidLt = clamp(2.72 + 0.55 * vlT + 0.45 * ltSpread, 2.45, 4.05);
  const yLt2Knot = clamp(3.55 + 0.42 * vlT + 0.35 * ltSpread, 3.35, 5.1);

  const xs = [60, xMidLow, lt1, xMidLt, lt2, 100];
  const ys = [y0, yMidLow, 2.05, yMidLt, yLt2Knot, Lftp];

  for (let i = 1; i < ys.length; i++) {
    if (ys[i]! <= ys[i - 1]!) ys[i] = ys[i - 1]! + 0.04;
  }
  return { xs, ys };
}

export type SteadyStateLactateCurveParams = {
  pctFtp: number;
  lt1Pct: number;
  lt2Pct: number;
  vlamax: number;
};

/**
 * BLa (mmol/L) schematic, smooth monotone vs %FTP — incremental-test-like curvature, MLSS at FTP.
 */
export function steadyStateBloodLactateMmol(input: SteadyStateLactateCurveParams): number {
  const x = clamp(input.pctFtp, 55, 130);
  const { xs, ys } = buildLactateKnots(input.lt1Pct, input.lt2Pct, input.vlamax);
  const m = pchipSlopes(xs, ys);
  let L = pchipEval(xs, ys, m, Math.min(x, 100));

  if (x > 100) {
    const L100 = pchipEval(xs, ys, m, 100);
    const w = (x - 100) / 22;
    const vlN = clamp((clamp(input.vlamax, 0.15, 1.6) - 0.15) / 0.65, 0, 1);
    const accum = 2.35 * (1 - Math.exp(-1.08 * w)) * (0.78 + vlN * 0.42);
    L = clamp(L100 + accum, 0.5, 14);
  } else {
    L = clamp(L, 0.5, 8);
  }
  return L;
}

/**
 * Peak BLa after short maximal / VO2max-type effort (literature order ~15–22 mmol/L trained).
 * Scaled with the same glycolytic proxy band (~0.3–0.8) used by the CP engine.
 */
export function estimatePeakBloodLactateMmol(vlamax: number): number {
  const vl = clamp(vlamax, 0.15, 1.6);
  const t = clamp((vl - 0.15) / 0.65, 0, 1);
  return clamp(13.4 + t * 8.4, 14, 22);
}
