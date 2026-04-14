import type { FuelingCategory } from "@/lib/nutrition/fueling-product-catalog";

export type FuelingProtocolSlot = {
  phase: string;
  time: string;
  icon: string;
  plan: string;
  cho: number;
  fluid: number;
  notes: string;
  category: FuelingCategory;
};

export type FuelingGlycogenDepletionModel = {
  totalGlycogen: number;
  blocks: unknown[];
  points: Array<{ xHour: number; pct: number; grams: number }>;
  totalConsume: number;
  totalIntake: number;
  totalAbsorbed: number;
  totalCori: number;
  totalNet: number;
  finalRemaining: number;
  finalPct: number;
  finalZone: "green" | "yellow" | "red";
  totalHours: number;
};

type PhysioLike = {
  choSharePct: number;
  vLamax: number;
  oxidativeCeilingKcalMin: number;
  redoxPct: number;
  gutDeliveryPct: number;
  coriReturnG: number;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function round(v: number, digits = 0) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}

function n(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const x = Number(v);
    return Number.isFinite(x) ? x : fallback;
  }
  return fallback;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return "";
  if (points.length < 3) return `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/** Pre + intra (step ogni ~20') + post per una singola seduta. */
export function buildFuelingProtocolSlots(input: {
  durationMin: number;
  preCho: number;
  postCho: number;
  intraTotalCho: number;
  effectiveFluidMlPerHour: number;
  resolvedFuelingTierBand: string;
  engineSuffix: string;
  intraSplitNote: string;
  profileSupplements: string[];
}): FuelingProtocolSlot[] {
  const brandA = input.profileSupplements[0] ?? "Enervit";
  const brandB = input.profileSupplements[1] ?? brandA;
  const brandC = input.profileSupplements[2] ?? brandA;
  const durationMin = Math.max(1, input.durationMin);
  const durationHours = Math.max(0.5, durationMin / 60);
  const preCho = Math.max(12, round(input.preCho));
  const postCho = Math.max(18, round(input.postCho));
  const intraTotalCho = Math.max(0, round(input.intraTotalCho, 1));
  const intraStepsCount = Math.max(1, Math.ceil(durationMin / 20));
  const perStepFluid = Math.max(
    120,
    round((input.effectiveFluidMlPerHour * durationHours) / intraStepsCount),
  );
  const rawStepCho = intraStepsCount > 0 ? intraTotalCho / intraStepsCount : intraTotalCho;
  const engineSuffix = input.engineSuffix;
  const intraSplitNote = input.intraSplitNote;

  const intraSteps = Array.from({ length: intraStepsCount }, (_, i) => {
    const minute = i * 20;
    const isLast = i === intraStepsCount - 1;
    const distributedBefore = round(rawStepCho * i, 1);
    const remaining = Math.max(0, round(intraTotalCho - distributedBefore, 1));
    const stepCho = isLast ? remaining : round(rawStepCho, 1);
    const category: FuelingCategory = i % 3 === 0 ? "drink" : i % 3 === 1 ? "gel" : "chew";
    const formatLabel =
      category === "drink"
        ? `drink mix ${brandA}`
        : category === "gel"
          ? `gel 2:1 ${brandB}`
          : `chew/bar ${brandC}`;
    return {
      phase: "Intra",
      time: minute === 0 ? "0'" : `+${minute}'`,
      icon: "🟦",
      plan: `${stepCho}g CHO via ${formatLabel}`,
      cho: stepCho,
      fluid: perStepFluid,
      notes:
        i === 0
          ? `Tier ${input.resolvedFuelingTierBand} · steady delivery${engineSuffix}${intraSplitNote}`
          : `Tier ${input.resolvedFuelingTierBand} · steady delivery`,
      category,
    } satisfies FuelingProtocolSlot;
  });

  return [
    {
      phase: "Pre-workout",
      time: "-30'",
      icon: "🟣",
      plan: `${preCho}g CHO + priming mix (${brandA}) + 300ml acqua`,
      cho: preCho,
      fluid: 300,
      notes: `Priming metabolico · tier ${input.resolvedFuelingTierBand}${engineSuffix}${intraSplitNote}`,
      category: "drink",
    },
    ...intraSteps,
    {
      phase: "Post-workout",
      time: "+10'",
      icon: "🟢",
      plan: `${postCho}g CHO + recovery protein blend (${brandC}) + 350ml acqua`,
      cho: postCho,
      fluid: 350,
      notes: `Recovery immediato${engineSuffix}`,
      category: "recovery",
    },
  ];
}

export function computeGlycogenDepletionForFueling(input: {
  weightKg: number;
  muscleMassKg: number | null | undefined;
  durationMin: number;
  intensityPctFtp: number;
  fuelingPhysiology: PhysioLike;
  resolvedFuelingChoGPerHour: number;
}): FuelingGlycogenDepletionModel {
  const weight = n(input.weightKg, 72);
  const muscleKg = n(input.muscleMassKg, weight * 0.45);
  const totalGlycogen = round(muscleKg * 12.5 + 95);
  const durationHours = Math.max(0.5, n(input.durationMin, 120) / 60);
  const fp = input.fuelingPhysiology;
  const burnBase = clamp(
    72 +
      (input.intensityPctFtp - 55) * 1.75 +
      (fp.choSharePct - 55) * 1.35 +
      fp.vLamax * 18,
    80,
    250,
  );
  const intakeRate = clamp(input.resolvedFuelingChoGPerHour, 0, 150);
  const absorbedRate = intakeRate * (fp.gutDeliveryPct / 100);
  const coriRate = fp.coriReturnG > 0 ? fp.coriReturnG / durationHours : 0;
  const dt = 1 / 6;

  let time = 0;
  let remaining = totalGlycogen;
  const points: Array<{ xHour: number; pct: number; grams: number }> = [{ xHour: 0, pct: 100, grams: totalGlycogen }];

  while (time < durationHours) {
    const remainingRatio = remaining / Math.max(1, totalGlycogen);
    const metabolicDownshift = 0.72 + remainingRatio * 0.42;
    const oxidativeProtection =
      fp.oxidativeCeilingKcalMin > 0
        ? clamp(fp.oxidativeCeilingKcalMin / 14, 0.82, 1.06)
        : 1;
    const redoxPenalty = 1 + clamp((fp.redoxPct - 50) / 200, -0.08, 0.18);
    const burnRate = burnBase * metabolicDownshift * redoxPenalty / oxidativeProtection;
    const netRate = Math.max(6, burnRate - absorbedRate - coriRate);
    remaining = Math.max(0, remaining - netRate * dt);
    time = Math.min(durationHours, time + dt);
    const pct = (remaining / Math.max(1, totalGlycogen)) * 100;
    points.push({ xHour: round(time, 2), pct: round(pct, 2), grams: round(remaining, 1) });
  }

  const totalConsume = round(burnBase * durationHours);
  const totalIntake = round(intakeRate * durationHours);
  const totalAbsorbed = round(absorbedRate * durationHours);
  const totalCori = round(coriRate * durationHours);
  const totalNet = Math.max(0, round(totalConsume - totalAbsorbed - totalCori));
  const finalRemaining = points[points.length - 1]?.grams ?? totalGlycogen;
  const finalPct = points[points.length - 1]?.pct ?? 100;
  const finalZone: "green" | "yellow" | "red" = finalPct > 60 ? "green" : finalPct > 30 ? "yellow" : "red";

  return {
    totalGlycogen,
    blocks: [],
    points,
    totalConsume,
    totalIntake,
    totalAbsorbed,
    totalCori,
    totalNet,
    finalRemaining: round(finalRemaining),
    finalPct: round(finalPct, 1),
    finalZone,
    totalHours: round(durationHours, 2),
  };
}

export function buildGlycogenPlotGeometry(model: FuelingGlycogenDepletionModel) {
  const w = 760;
  const h = 230;
  const padL = 52;
  const padR = 28;
  const padT = 18;
  const padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const maxX = Math.max(1, model.totalHours);
  const toX = (x: number) => padL + (x / maxX) * chartW;
  const toY = (pct: number) => padT + ((100 - pct) / 100) * chartH;
  const plotted = model.points.map((p) => ({ x: toX(p.xHour), y: toY(p.pct) }));
  const smoothPath = buildSmoothPath(plotted);
  const areaPath = `${smoothPath} L ${toX(model.totalHours)} ${toY(0)} L ${toX(0)} ${toY(0)} Z`;

  return { w, h, padL, padR, padT, padB, chartW, chartH, toX, toY, smoothPath, areaPath };
}
