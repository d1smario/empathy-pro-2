import type { Metadata } from "next";
import { PricingHostedCheckout } from "@/components/commerce/PricingHostedCheckout";
import { StripeCheckoutLink } from "@/components/commerce/StripeCheckoutLink";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2Link } from "@/components/ui/empathy";
import { hostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import { getStripePaymentLink } from "@/lib/stripe-payment-link";

export const metadata: Metadata = {
  title: "Pricing",
  robots: { index: true, follow: true },
};

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

/**
 * Rotta anonima (`isAnonymousAllowedPath`). Payment Link pubblico e/o Checkout Silver/Gold (V1 price ID).
 */
export default function PricingPage({ searchParams }: PageProps) {
  const stripeCheckout = getStripePaymentLink();
  const hosted = hostedCheckoutAvailability();
  const billingRaw = searchParams?.billing;
  const billing = typeof billingRaw === "string" ? billingRaw : undefined;
  const hasPrimaryCta = Boolean(stripeCheckout) || hosted.silver || hosted.gold;

  return (
    <BrutalistAppBackdrop matrix={false}>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative mx-auto max-w-lg scroll-mt-0 px-6 py-20 outline-none sm:py-28"
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.35em] text-gray-500">Pricing</p>
        <h1 className="mt-3 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
          Pro 2.0
        </h1>
        <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-80" />
        {billing === "success" ? (
          <p
            className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
            role="status"
          >
            Pagamento completato. Grazie — quando il backend sarà collegato, lo stato abbonamento sarà qui.
          </p>
        ) : null}
        {billing === "cancel" ? (
          <p
            className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            role="status"
          >
            Checkout annullato. Puoi riprovare quando vuoi.
          </p>
        ) : null}
        <p className="mt-8 text-sm leading-relaxed text-gray-400">
          Stessi nomi variabile Stripe di V1 (<code className="font-mono text-xs text-pink-300">.env.example</code>
          ). Payment Link opzionale; abbonamento Silver/Gold con sessione Stripe se abiliti il flag anonimo sul
          server.
        </p>
        <div className="mt-12 flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
          {stripeCheckout ? <StripeCheckoutLink href={stripeCheckout} /> : null}
          <Pro2Link
            href="/access"
            variant={hasPrimaryCta ? "secondary" : "primary"}
            className="justify-center px-8"
          >
            Access
          </Pro2Link>
          <Pro2Link href="/dashboard" variant="secondary" className="justify-center px-8">
            Shell
          </Pro2Link>
          <Pro2Link href="/" variant="ghost" className="justify-center px-8">
            Home
          </Pro2Link>
        </div>
        <PricingHostedCheckout availability={hosted} />
      </main>
    </BrutalistAppBackdrop>
  );
}
