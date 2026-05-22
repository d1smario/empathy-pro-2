import type { EmpathyBasePlanId } from "@empathy/contracts";
import { isPaywallEnforced } from "@/lib/billing/paywall-config";
import { stripePriceIdForBasePlan, stripePriceIdForCoachAddOn } from "@/lib/billing/stripe-price-ids";
import { readStripeSecretKey } from "@/lib/billing/stripe-secret";

export type HostedCheckoutAvailability = Record<EmpathyBasePlanId, boolean> & {
  coachElite: boolean;
  coachPro: boolean;
  coachOlimpic: boolean;
};

/**
 * Checkout hosted Stripe (registrazione atleta + landing).
 * Attivo se: secret + prezzi configurati E (flag esplicito O paywall commerciale attivo).
 */
export function isStripeHostedCheckoutEnabled(): boolean {
  const v = process.env.STRIPE_CHECKOUT_ANON_ENABLED?.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;
  return isPaywallEnforced();
}

/** @deprecated alias */
export function isAnonymousStripeCheckoutEnabled(): boolean {
  return isStripeHostedCheckoutEnabled();
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
  if (!isStripeHostedCheckoutEnabled()) {
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

export function checkoutPayReady(): boolean {
  if (!isStripeHostedCheckoutEnabled()) return false;
  if (readStripeSecretKey() == null) return false;
  return stripePriceIdForBasePlan("silver") != null || stripePriceIdForBasePlan("gold") != null;
}
