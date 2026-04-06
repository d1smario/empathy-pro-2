export type AccountBillingCurrency = "EUR";
export type AccountBillingInterval = "month";

/** Literal allineati a V1 catalog / Stripe price env. */
export const EMPATHY_BASE_PLAN_IDS = ["silver", "gold"] as const;
export const EMPATHY_COACH_ADDON_IDS = ["elite", "pro", "olimpic"] as const;

export type EmpathyBasePlanId = (typeof EMPATHY_BASE_PLAN_IDS)[number];
export type EmpathyCoachAddOnId = (typeof EMPATHY_COACH_ADDON_IDS)[number];

const _basePlanSet = new Set<string>(EMPATHY_BASE_PLAN_IDS);
const _coachAddOnSet = new Set<string>(EMPATHY_COACH_ADDON_IDS);

export function isEmpathyBasePlanId(value: unknown): value is EmpathyBasePlanId {
  return typeof value === "string" && _basePlanSet.has(value);
}

export function isEmpathyCoachAddOnId(value: unknown): value is EmpathyCoachAddOnId {
  return typeof value === "string" && _coachAddOnSet.has(value);
}

export type EmpathyPlanKind = "base" | "coach_addon";

export type StripeLookupRef = {
  productLookupKey?: string | null;
  priceLookupKey?: string | null;
};

export type EmpathyPlanCatalogItem = {
  id: EmpathyBasePlanId | EmpathyCoachAddOnId;
  kind: EmpathyPlanKind;
  label: string;
  monthlyPrice: number;
  currency: AccountBillingCurrency;
  interval: AccountBillingInterval;
  trialEligible: boolean;
  summary: string;
  features: string[];
  stripe: StripeLookupRef | null;
};

export type EmpathyTrialPolicy = {
  trialDays: number;
  eligiblePlanIds: EmpathyBasePlanId[];
  notes: string[];
};

export type EmpathyComplianceSection = {
  id: "privacy" | "legal" | "account" | "future";
  title: string;
  summary: string;
};

export type EmpathyAccountCatalog = {
  billingProvider: "stripe";
  basePlans: EmpathyPlanCatalogItem[];
  coachAddOns: EmpathyPlanCatalogItem[];
  trialPolicy: EmpathyTrialPolicy;
  compliance: EmpathyComplianceSection[];
};
