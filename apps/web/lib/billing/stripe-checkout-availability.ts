import type { EmpathyBasePlanId } from "@empathy/contracts";
import { stripePriceIdForBasePlan, stripePriceIdForCoachAddOn } from "@/lib/billing/stripe-price-ids";
import { readStripeSecretKey } from "@/lib/billing/stripe-secret";

export type HostedCheckoutAvailability = Record<EmpathyBasePlanId, boolean> & {
  coachElite: boolean;
  coachPro: boolean;
  coachOlimpic: boolean;
};

/**
 * Checkout hosted senza utente Supabase (solo Pro 2 demo / staging).
 * Produzione: preferire flusso V1 autenticato + `billing_customers`.
 */
export function isAnonymousStripeCheckoutEnabled(): boolean {
  return process.env.STRIPE_CHECKOUT_ANON_ENABLED === "1";
}

function disabledHosted(): HostedCheckoutAvailability {
  return {
    silver: false,
    gold: false,
    coachElite: false,
    coachPro: false,
    coachOlimpic: false,
  };
}

export function hostedCheckoutAvailability(): HostedCheckoutAvailability {
  if (!isAnonymousStripeCheckoutEnabled()) {
    return disabledHosted();
  }
  if (readStripeSecretKey() == null) {
    return disabledHosted();
  }
  return {
    silver: stripePriceIdForBasePlan("silver") != null,
    gold: stripePriceIdForBasePlan("gold") != null,
    coachElite: stripePriceIdForCoachAddOn("elite") != null,
    coachPro: stripePriceIdForCoachAddOn("pro") != null,
    coachOlimpic: stripePriceIdForCoachAddOn("olimpic") != null,
  };
}
