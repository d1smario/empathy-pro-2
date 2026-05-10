import type { Metadata } from "next";
import { EmpathyPublicHome } from "@/components/marketing/EmpathyPublicHome";

export const metadata: Metadata = {
  title: "Pricing — Empathy Pro 2.0",
  robots: { index: true, follow: true },
};

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

/**
 * Stessa esperienza della home sulla sezione piani; utile per link diretti e campagne.
 * Redirect post-checkout: default verso `/?billing=*` (vedi `stripe-app-url`).
 * Quando arrivi da paywall (`?required=athlete_access`) mostriamo banner di contesto.
 */
export default function PricingPage({ searchParams }: PageProps) {
  const billingRaw = searchParams?.billing;
  const billing = billingRaw === "success" ? "success" : billingRaw === "cancel" ? "cancel" : undefined;
  const required = typeof searchParams?.required === "string" ? searchParams.required : null;

  const requiredMessage =
    required === "athlete_access"
      ? "Per usare la piattaforma Empathy serve un piano attivo o un accesso concesso dall’admin (testimonial / promo). Scegli un piano qui sotto, oppure scrivi a supporto se ritieni di aver diritto a un accesso gratuito."
      : null;

  return (
    <>
      {requiredMessage ? (
        <div className="bg-amber-950/40 px-6 py-3 text-center text-xs text-amber-200">
          <span className="font-semibold uppercase tracking-wider text-amber-300">Accesso richiesto</span>
          <span className="ml-2 text-amber-100/90">{requiredMessage}</span>
        </div>
      ) : null}
      <EmpathyPublicHome billingFlash={billing} variant="pricing-page" />
    </>
  );
}
