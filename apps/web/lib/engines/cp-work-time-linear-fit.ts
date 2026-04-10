/**
 * Linear critical-power model in work–time form: W(t) = W′ + CP·t (Joules).
 * Cross-check against hybrid CP fit: large ΔCP or negative R² flags inconsistent inputs.
 */

import type { CpInputPoint } from "@/lib/engines/critical-power-engine";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export type CpWorkTimeLinearFitResult = {
  cpW: number;
  wPrimeJ: number;
  r2: number;
  rmseJ: number;
};

function weightedLinearRegression(xs: number[], ys: number[], ws: number[]) {
  const wSum = ws.reduce((s, w) => s + w, 0);
  if (wSum <= 0 || xs.length < 2 || ys.length < 2 || ws.length < 2) {
    return { slope: 0, intercept: 0, r2: 0, rmse: Number.POSITIVE_INFINITY };
  }
  const meanX = xs.reduce((s, x, i) => s + x * ws[i]!, 0) / wSum;
  const meanY = ys.reduce((s, y, i) => s + y * ws[i]!, 0) / wSum;
  let cov = 0;
  let varX = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const dx = xs[i]! - meanX;
    cov += ws[i]! * dx * (ys[i]! - meanY);
    varX += ws[i]! * dx * dx;
  }
  const slope = varX > 1e-9 ? cov / varX : 0;
  const intercept = meanY - slope * meanX;
  const preds = xs.map((x) => slope * x + intercept);
  const rmse = Math.sqrt(
    preds.reduce((s, p, i) => s + ws[i]! * (ys[i]! - p) ** 2, 0) / Math.max(1, wSum),
  );
  const ssTot = ys.reduce((s, y, i) => s + ws[i]! * (y - meanY) ** 2, 0);
  const ssRes = preds.reduce((s, p, i) => s + ws[i]! * (ys[i]! - p) ** 2, 0);
  const r2 = ssTot > 0 ? clamp(1 - ssRes / ssTot, -1, 1) : 0;
  return { slope, intercept, r2, rmse };
}

/**
 * Fit CP and W′ from work = power·t vs t (30 s–3600 s), weighted like CP engine long-domain points.
 */
export function fitCpWorkTimeLinearModel(points: CpInputPoint[]): CpWorkTimeLinearFitResult | null {
  const set = points
    .filter((p) => p.sec >= 30 && p.sec <= 3600 && p.powerW > 0)
    .sort((a, b) => a.sec - b.sec);
  if (set.length < 3) return null;

  const xs = set.map((p) => p.sec);
  const ys = set.map((p) => p.powerW * p.sec);
  const ws = set.map((p) => clamp(Math.sqrt(p.sec / 90), 0.5, 2.5));

  const { slope, intercept, r2, rmse } = weightedLinearRegression(xs, ys, ws);
  const cpW = slope;
  const wPrimeJ = intercept;

  if (!Number.isFinite(cpW) || !Number.isFinite(wPrimeJ) || cpW < 40 || wPrimeJ < 500) {
    return null;
  }

  return {
    cpW,
    wPrimeJ,
    r2,
    rmseJ: rmse,
  };
}

export type CpWorkTimeLinearCrossCheck = CpWorkTimeLinearFitResult & {
  /** 100·(CP_linear − CP_hybrid) / CP_hybrid */
  deltaHybridCpPct: number;
  /** 100·(W′_linear − W′_hybrid) / W′_hybrid */
  deltaHybridWPrimePct: number;
};

export function buildCpWorkTimeCrossCheck(
  points: CpInputPoint[],
  hybridCp: number,
  hybridWPrimeJ: number,
): CpWorkTimeLinearCrossCheck | null {
  const fit = fitCpWorkTimeLinearModel(points);
  if (!fit) return null;
  const hCp = Math.max(1, hybridCp);
  const hW = Math.max(1, hybridWPrimeJ);
  return {
    ...fit,
    deltaHybridCpPct: (100 * (fit.cpW - hCp)) / hCp,
    deltaHybridWPrimePct: (100 * (fit.wPrimeJ - hW)) / hW,
  };
}
