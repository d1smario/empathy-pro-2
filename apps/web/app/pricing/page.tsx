import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ACCESS_PLAN_PATH } from "@/lib/billing/paywall-config";
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
export default async function PricingPage({ searchParams }: PageProps) {
  const billingRaw = searchParams?.billing;
  const billing = billingRaw === "success" ? "success" : billingRaw === "cancel" ? "cancel" : undefined;
  const required = typeof searchParams?.required === "string" ? searchParams.required : null;
  if (required === "athlete_access" || required === "subscription") {
    redirect(`${ACCESS_PLAN_PATH}?required=subscription`);
  }
  const t = await getTranslations("Pricing");
  const showPaywallBanner = false;

  return (
    <>
      {showPaywallBanner ? (
        <div className="bg-amber-950/40 px-6 py-3 text-center text-xs text-amber-200">
          <span className="font-semibold uppercase tracking-wider text-amber-300">
            {t("paywallBannerLabel")}
          </span>
          <span className="ml-2 text-amber-100/90">{t("paywallBannerBody")}</span>
        </div>
      ) : null}
      <EmpathyPublicHome billingFlash={billing} variant="pricing-page" />
    </>
  );
}
