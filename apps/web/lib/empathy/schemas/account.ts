export type AccountBillingCurrency = "EUR";
export type AccountBillingInterval = "month";

export type EmpathyBasePlanId = "silver" | "gold";
export type EmpathyCoachAddOnId = "elite" | "pro" | "olimpic";
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
