/** Stripe server client — secret key only in server env / CI secrets, never in client bundles. */
import Stripe from "stripe";

export const INTEGRATION = "@empathy/integrations-stripe" as const;

export type StripeSecretConfig = {
  secretKey: string;
};

export function isStripeSecretConfigured(c: Partial<StripeSecretConfig>): c is StripeSecretConfig {
  return Boolean(c.secretKey?.trim());
}

/** Use in API routes / server actions after reading `process.env.STRIPE_SECRET_KEY`. */
export function createStripeServerClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    typescript: true,
  });
}
