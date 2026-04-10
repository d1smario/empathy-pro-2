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
 */
export default function PricingPage({ searchParams }: PageProps) {
  const billingRaw = searchParams?.billing;
  const billing = billingRaw === "success" ? "success" : billingRaw === "cancel" ? "cancel" : undefined;

  return <EmpathyPublicHome billingFlash={billing} variant="pricing-page" />;
}
