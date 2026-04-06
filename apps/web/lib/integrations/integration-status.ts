import "server-only";

import { logMealConfigFromEnv } from "@empathy/integrations-logmeal";
import { splineSceneBaseUrlFromEnv } from "@empathy/integrations-spline";
import { isSupabasePublicConfigured, type SupabasePublicConfig } from "@empathy/integrations-supabase";
import { isAnonymousStripeCheckoutEnabled } from "@/lib/billing/stripe-checkout-availability";
import { readStripeSecretKey, readStripeWebhookSecret } from "@/lib/billing/stripe-secret";
import { getStripePaymentLink } from "@/lib/stripe-payment-link";

function readEnv(name: string): string | undefined {
  return process.env[name];
}

function envNonEmpty(name: string): boolean {
  return Boolean(readEnv(name)?.trim());
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const c = {
    url: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
  return isSupabasePublicConfigured(c) ? c : null;
}

/** Presenza variabili (booleani) — mai valori o segreti. */
export type IntegrationPresence = {
  supabase: boolean;
  stripeSecret: boolean;
  stripePublishable: boolean;
  stripeWebhook: boolean;
  /** V1: `STRIPE_PRICE_*` — solo flag presenza, mai gli ID. */
  stripePriceSilver: boolean;
  stripePriceGold: boolean;
  stripeCoachPriceElite: boolean;
  stripeCoachPricePro: boolean;
  stripeCoachPriceOlimpic: boolean;
  /** Pro 2 `/pricing`: `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` HTTPS valido. */
  stripePaymentLinkPublic: boolean;
  /** `POST /api/billing/checkout-session` senza auth (solo demo). */
  stripeCheckoutAnonEnabled: boolean;
  logmeal: boolean;
  spline: boolean;
};

export function getIntegrationPresence(): IntegrationPresence {
  return {
    supabase: getSupabasePublicConfig() != null,
    stripeSecret: readStripeSecretKey() != null,
    stripePublishable: Boolean(readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")?.trim()),
    stripeWebhook: readStripeWebhookSecret() != null,
    stripePriceSilver: envNonEmpty("STRIPE_PRICE_SILVER_EUR"),
    stripePriceGold: envNonEmpty("STRIPE_PRICE_GOLD_EUR"),
    stripeCoachPriceElite: envNonEmpty("STRIPE_PRICE_COACH_ELITE_EUR"),
    stripeCoachPricePro: envNonEmpty("STRIPE_PRICE_COACH_PRO_EUR"),
    stripeCoachPriceOlimpic: envNonEmpty("STRIPE_PRICE_COACH_OLIMPIC_EUR"),
    stripePaymentLinkPublic: getStripePaymentLink() != null,
    stripeCheckoutAnonEnabled: isAnonymousStripeCheckoutEnabled(),
    logmeal: logMealConfigFromEnv(readEnv) != null,
    spline: splineSceneBaseUrlFromEnv(readEnv) != null,
  };
}
