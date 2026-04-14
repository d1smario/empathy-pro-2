import {
  FUELING_PRODUCT_CATALOG,
  type FuelingCategory,
  type FuelingProduct,
  isIntraCarbohydrateEligibleProduct,
} from "@/lib/nutrition/fueling-product-catalog";

function roundN(v: number, digits = 1) {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}

/** Ordina i candidati intra per marchi preferiti (profilo), poi resto catalogo. */
export function orderIntraCarbohydrateCandidates(preferredBrands: string[]): FuelingProduct[] {
  const eligible = FUELING_PRODUCT_CATALOG.filter(isIntraCarbohydrateEligibleProduct);
  const ordered: FuelingProduct[] = [];
  const used = new Set<string>();
  for (const brand of preferredBrands) {
    for (const p of eligible) {
      if (p.brand !== brand) continue;
      const key = `${p.brand}__${p.product}`;
      if (used.has(key)) continue;
      used.add(key);
      ordered.push(p);
    }
  }
  for (const p of eligible) {
    const key = `${p.brand}__${p.product}`;
    if (used.has(key)) continue;
    used.add(key);
    ordered.push(p);
  }
  return ordered.length ? ordered : eligible;
}

export type IntraFuelingPlanStep = {
  slot: {
    phase: string;
    time: string;
    icon: string;
    plan: string;
    cho: number;
    fluid: number;
    notes: string;
    category: FuelingCategory;
  };
  product: FuelingProduct;
  engineLinearStepChoG: number;
};

/**
 * Intra da catalogo carbo-only: CHO step = porzione dichiarata quando presente,
 * altrimenti obiettivo lineare per quella finestra. Mai attribuire CHO “fittizi” a BCAA/protein.
 */
export function buildIntraFuelingPlan(params: {
  intraTotalCho: number;
  durationMin: number;
  perStepFluid: number;
  preferredBrands: string[];
  tierBand: string;
}): IntraFuelingPlanStep[] {
  const { intraTotalCho, durationMin, perStepFluid, preferredBrands, tierBand } = params;
  const intraStepsCount = Math.max(1, Math.ceil(durationMin / 20));
  const raw = intraStepsCount > 0 ? intraTotalCho / intraStepsCount : intraTotalCho;
  const engineSteps: number[] = [];
  for (let i = 0; i < intraStepsCount; i++) {
    const isLast = i === intraStepsCount - 1;
    const distributedBefore = roundN(raw * i, 1);
    const remaining = Math.max(0, roundN(intraTotalCho - distributedBefore, 1));
    engineSteps.push(isLast ? remaining : roundN(raw, 1));
  }

  const candidates = orderIntraCarbohydrateCandidates(preferredBrands);
  const steps: IntraFuelingPlanStep[] = [];

  for (let i = 0; i < intraStepsCount; i++) {
    const product = candidates[i % Math.max(1, candidates.length)];
    const engineCho = engineSteps[i];
    const labelG = product.carbohydrateGPerServing;
    const cho =
      labelG != null && labelG > 0 ? labelG : Math.max(0, roundN(engineCho, 1));
    const deltaNote =
      labelG != null && labelG > 0 && Math.abs(cho - engineCho) >= 1
        ? ` · porzione catalogo ${cho}g vs obiettivo lineare ~${engineCho}g`
        : labelG == null || labelG <= 0
          ? " · CHO da obiettivo lineare (porzione non valorizzata in catalogo)"
          : "";

    const minute = i * 20;
    const time = minute === 0 ? "0'" : `+${minute}'`;
    const plan = `${cho}g CHO · ${product.brand} — ${product.product}`;

    steps.push({
      slot: {
        phase: "Intra",
        time,
        icon: "🟦",
        plan,
        cho,
        fluid: perStepFluid,
        notes: `Tier ${tierBand} · intra carbo${deltaNote}`,
        category: product.category,
      },
      product,
      engineLinearStepChoG: engineCho,
    });
  }

  const totalDeclared = roundN(steps.reduce((s, x) => s + x.slot.cho, 0), 1);
  const budgetDelta = roundN(totalDeclared - intraTotalCho, 1);
  if (steps.length && Math.abs(budgetDelta) >= 0.5) {
    steps[0].slot.notes += ` · Σ intra CHO ${totalDeclared}g vs target motore ${intraTotalCho}g (Δ ${budgetDelta >= 0 ? "+" : ""}${budgetDelta}g)`;
  }
  return steps;
}

export function resolvePreWorkoutCarbProduct(preferredBrands: string[]): FuelingProduct {
  const ok = (p: FuelingProduct) =>
    p.timing.includes("pre") &&
    p.functionalFocus.includes("carbo") &&
    !p.functionalFocus.includes("bcaa") &&
    !p.functionalFocus.includes("eaa");
  for (const brand of preferredBrands) {
    const hit = FUELING_PRODUCT_CATALOG.find((p) => p.brand === brand && ok(p));
    if (hit) return hit;
  }
  return FUELING_PRODUCT_CATALOG.find(ok) ?? FUELING_PRODUCT_CATALOG[0];
}

export function resolvePostRecoveryProduct(preferredBrands: string[]): FuelingProduct {
  for (const brand of preferredBrands) {
    const hit = FUELING_PRODUCT_CATALOG.find(
      (p) => p.brand === brand && p.category === "recovery" && (p.timing.includes("post") || p.timing.includes("daily")),
    );
    if (hit) return hit;
  }
  return FUELING_PRODUCT_CATALOG.find((p) => p.category === "recovery") ?? FUELING_PRODUCT_CATALOG[0];
}
