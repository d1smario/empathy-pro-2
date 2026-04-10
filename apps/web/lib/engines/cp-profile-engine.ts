export type CpModelPoint = {
  sec: number;
  powerW: number;
};

export type CpProfileInput = {
  points: CpModelPoint[];
  efficiency?: number;
};

export type CpZoneRow = {
  name: string;
  low: number;
  high: number;
  avgW: number;
  kcalH: number;
  choG: number;
  fatG: number;
  rer: number;
};

export type CpProfileOutput = {
  cpW: number;
  wPrimeJ: number;
  wPrimeKj: number;
  pcrCapacityKj: number;
  glycolyticCapacityKj: number;
  modelFitR2: number;
  oxidativeScore: number;
  oxidativeProfile: "oxidative" | "balanced" | "glycolytic";
  ftp: number;
  lt1: number;
  lt2: number;
  fatmax: number;
  vlamax: number;
  sprintReserve: number;
  substrateTable: CpZoneRow[];
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 3) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

function estimateRerFromFtpIntensity(intensityPctFtp: number, oxidativeScore: number) {
  const i = clamp(intensityPctFtp, 40, 130);
  const points = [
    { x: 40, y: 0.76 },
    { x: 55, y: 0.8 },
    { x: 70, y: 0.86 },
    { x: 80, y: 0.9 },
    { x: 90, y: 0.93 },
    { x: 100, y: 0.95 },
    { x: 108, y: 1.0 },
    { x: 120, y: 1.03 },
    { x: 130, y: 1.05 },
  ];
  let base = 0.9;
  for (let idx = 0; idx < points.length - 1; idx += 1) {
    const left = points[idx];
    const right = points[idx + 1];
    if (i >= left.x && i <= right.x) {
      const t = (i - left.x) / (right.x - left.x);
      base = left.y + (right.y - left.y) * t;
      break;
    }
  }
  const belowThresholdFactor = clamp((95 - i) / 35, 0, 1);
  const adaptationShift = (0.5 - clamp(oxidativeScore, 0, 1)) * 0.08 * belowThresholdFactor;
  return clamp(base + adaptationShift, 0.72, 1.05);
}

function fitCpAndWPrime(points: CpModelPoint[]) {
  const fitPoints = points.filter((p) => p.sec >= 180 && p.sec <= 1800 && p.powerW > 0);
  if (fitPoints.length < 2) return null;

  const xs = fitPoints.map((p) => 1 / p.sec);
  const ys = fitPoints.map((p) => p.powerW);
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0);
  const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  if (den <= 0) return null;

  const slope = num / den; // J
  const intercept = meanY - slope * meanX; // W
  const cpW = Math.max(1, intercept);
  const wPrimeJ = Math.max(1000, slope);

  const preds = xs.map((x) => cpW + wPrimeJ * x);
  const ssRes = ys.reduce((s, y, i) => s + (y - preds[i]) ** 2, 0);
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { cpW, wPrimeJ, r2: clamp(r2, 0, 1) };
}

export function computeCpProfileEngine(input: CpProfileInput): CpProfileOutput {
  const efficiency = clamp(input.efficiency ?? 0.24, 0.16, 0.35);
  const points = input.points
    .map((p) => ({ sec: Math.max(1, p.sec), powerW: Math.max(0, p.powerW) }))
    .sort((a, b) => a.sec - b.sec);

  const getPointPower = (sec: number, fallback = 0) => {
    const found = points.find((p) => p.sec === sec);
    return found ? found.powerW : fallback;
  };

  const p5 = getPointPower(5);
  const p60 = getPointPower(60);
  const p180 = getPointPower(180);
  const p300 = getPointPower(300);
  const p720 = getPointPower(720);
  const p1200 = getPointPower(1200);

  const fit = fitCpAndWPrime(points);
  const cpW = fit?.cpW ?? Math.max(1, 0.92 * p1200);
  const wPrimeJ = fit?.wPrimeJ ?? Math.max(4000, (Math.max(0, p180 - cpW) * 180));
  const wPrimeKj = wPrimeJ / 1000;

  // Estimate PCr component from very short-duration excess over CP-hyperbolic model.
  const shortPoints = points.filter((p) => p.sec <= 60 && p.powerW > 0);
  const pcrJ =
    shortPoints.length > 0
      ? shortPoints.reduce((s, p) => {
          const pred = cpW + wPrimeJ / p.sec;
          const extra = Math.max(0, p.powerW - pred);
          const weight = 1 / Math.sqrt(p.sec);
          return s + extra * p.sec * weight;
        }, 0) /
        shortPoints.reduce((s, p) => s + 1 / Math.sqrt(p.sec), 0)
      : Math.max(3000, (Math.max(0, p5 - p60) * 6));

  const pcrCapacityKj = clamp(pcrJ / 1000, 2, 35);
  const glycolyticCapacityKj = Math.max(0, wPrimeKj - 0.5 * pcrCapacityKj);

  const ftpFrom20 = p1200 > 0 ? p1200 * 0.95 : cpW * 0.93;
  const ftpFromCp = cpW * 0.93;
  const ftp = 0.6 * ftpFrom20 + 0.4 * ftpFromCp;

  const sprintReserve = Math.max(0, p5 - ftp);
  const enduranceRatio = p1200 > 0 ? p1200 / Math.max(1, cpW) : 0.85;
  const sprintRatio = p5 > 0 ? p5 / Math.max(1, cpW) : 1.4;
  const oxidativeScore = clamp(0.65 * enduranceRatio - 0.25 * (sprintRatio - 1), 0, 1);
  const oxidativeProfile =
    oxidativeScore >= 0.66 ? "oxidative" : oxidativeScore < 0.4 ? "glycolytic" : "balanced";

  const lt2 = Math.max(ftp * 1.01, cpW * 0.97);
  const lt1 = ftp * (0.72 + 0.1 * oxidativeScore);
  const fatmax = ftp * (0.58 + 0.08 * oxidativeScore);
  const vlamax = clamp(0.25 + glycolyticCapacityKj / 30 + sprintReserve / Math.max(400, cpW * 2), 0.2, 1.6);

  const zones = [
    { name: "Z1 Recovery", low: 0.5 * ftp, high: 0.6 * ftp },
    { name: "Z2 Endurance", low: 0.6 * ftp, high: 0.75 * ftp },
    { name: "Z3 Tempo", low: 0.76 * ftp, high: 0.9 * ftp },
    { name: "Z4 Threshold", low: 0.91 * ftp, high: 1.05 * ftp },
    { name: "Z5 VO2", low: 1.06 * ftp, high: 1.2 * ftp },
  ];

  const substrateTable = zones.map((z) => {
    const avgW = (z.low + z.high) / 2;
    const intensityPct = (avgW / Math.max(1, ftp)) * 100;
    const rer = estimateRerFromFtpIntensity(intensityPct, oxidativeScore);
    const choFrac = clamp((rer - 0.7) / 0.3, 0.05, 0.99);
    const fatFrac = 1 - choFrac;
    const kcalH = (avgW / efficiency) * 3600 / 4184;
    const choG = (kcalH * choFrac) / 4;
    const fatG = (kcalH * fatFrac) / 9;
    return {
      name: z.name,
      low: round(z.low),
      high: round(z.high),
      avgW: round(avgW),
      kcalH: round(kcalH),
      choG: round(choG),
      fatG: round(fatG),
      rer: round(rer),
    };
  });

  return {
    cpW: round(cpW),
    wPrimeJ: round(wPrimeJ),
    wPrimeKj: round(wPrimeKj),
    pcrCapacityKj: round(pcrCapacityKj),
    glycolyticCapacityKj: round(glycolyticCapacityKj),
    modelFitR2: round(fit?.r2 ?? 0),
    oxidativeScore: round(oxidativeScore),
    oxidativeProfile,
    ftp: round(ftp),
    lt1: round(lt1),
    lt2: round(lt2),
    fatmax: round(fatmax),
    vlamax: round(vlamax),
    sprintReserve: round(sprintReserve),
    substrateTable,
  };
}

