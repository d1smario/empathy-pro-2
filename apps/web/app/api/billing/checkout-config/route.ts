import { NextResponse } from "next/server";
import { hostedCheckoutAvailability, isAnonymousStripeCheckoutEnabled } from "@/lib/billing/stripe-checkout-availability";
import { readCheckoutTrialDays } from "@/lib/billing/stripe-checkout-trial";
import { readStripeWebhookSecret } from "@/lib/billing/stripe-secret";
import { getStripePaymentLink } from "@/lib/stripe-payment-link";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Solo flag pubblici per UI / diagnostica (nessun segreto, nessun price ID).
 */
export async function GET() {
  const hosted = hostedCheckoutAvailability();
  const trialDays = readCheckoutTrialDays();
  return NextResponse.json(
    {
      ok: true as const,
      webhookPath: "/api/webhooks/stripe" as const,
      anonCheckoutEnabled: isAnonymousStripeCheckoutEnabled(),
      paymentLinkConfigured: getStripePaymentLink() != null,
      webhookSecretConfigured: readStripeWebhookSecret() != null,
      trialConfigured: trialDays != null,
      trialDays: trialDays ?? null,
      hosted: {
        silver: hosted.silver,
        gold: hosted.gold,
        coachElite: hosted.coachElite,
        coachPro: hosted.coachPro,
        coachOlimpic: hosted.coachOlimpic,
      },
    },
    { headers: NO_STORE },
  );
}
