import type { EmpathyBasePlanId, EmpathyCoachAddOnId } from "@empathy/contracts";

/** Allineato a V1: base + coach add-on — tipi da `@empathy/contracts` (`billing/plan-ids`). */

const BASE_ENV: Record<EmpathyBasePlanId, string> = {
  silver: "STRIPE_PRICE_SILVER_EUR",
  gold: "STRIPE_PRICE_GOLD_EUR",
};

const COACH_ENV: Record<EmpathyCoachAddOnId, string> = {
  elite: "STRIPE_PRICE_COACH_ELITE_EUR",
  pro: "STRIPE_PRICE_COACH_PRO_EUR",
  olimpic: "STRIPE_PRICE_COACH_OLIMPIC_EUR",
};

function readPriceEnv(envName: string): string | null {
  const raw = process.env[envName];
  if (raw == null) return null;
  let v = raw.trim();
  if (v.charCodeAt(0) === 0xfeff) v = v.slice(1).trim();
  return v.length > 0 ? v : null;
}

export function stripePriceIdForBasePlan(planId: EmpathyBasePlanId): string | null {
  return readPriceEnv(BASE_ENV[planId]);
}

export function listMissingStripePriceEnvVars(planId: EmpathyBasePlanId): string[] {
  const name = BASE_ENV[planId];
  return readPriceEnv(name) ? [] : [name];
}

export function stripePriceIdForCoachAddOn(planId: EmpathyCoachAddOnId): string | null {
  return readPriceEnv(COACH_ENV[planId]);
}

/** Base + eventuale add-on coach (stessi env di V1). */
export function listMissingCheckoutPriceEnvVars(
  basePlanId: EmpathyBasePlanId,
  coachAddOnId: EmpathyCoachAddOnId | null,
): string[] {
  const missing = [...listMissingStripePriceEnvVars(basePlanId)];
  if (coachAddOnId) {
    const n = COACH_ENV[coachAddOnId];
    if (!readPriceEnv(n)) missing.push(n);
  }
  return missing;
}

export function formatMissingStripePriceMessage(missing: string[]): string {
  if (missing.length === 0) return "";
  return `Aggiungi in .env.local: ${missing.join(", ")} (Price ID da Stripe Dashboard).`;
}

export type { EmpathyBasePlanId, EmpathyCoachAddOnId } from "@empathy/contracts";
