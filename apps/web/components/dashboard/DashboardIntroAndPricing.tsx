"use client";

import { HomeStripePricing } from "@/components/marketing/HomeStripePricing";
import type { HostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import type { EmpathyPlanCatalogItem, EmpathyTrialPolicy } from "@empathy/contracts";

const EMPATHY_PITCH =
  "Empathy è una piattaforma di performance e physiology adaptation, capace di guidare l'adattamento attraverso timing, stimoli e nutrizione. Misurare il cambiamento e portarti alla vera performance.";

type DashboardIntroAndPricingProps = {
  hosted: HostedCheckoutAvailability;
  payReady: boolean;
  basePlans: EmpathyPlanCatalogItem[];
  coachAddOns: EmpathyPlanCatalogItem[];
  trialPolicy: EmpathyTrialPolicy;
  trialDaysConfigured?: number;
};

export function DashboardIntroAndPricing({
  hosted,
  payReady,
  basePlans,
  coachAddOns,
  trialPolicy,
  trialDaysConfigured,
}: DashboardIntroAndPricingProps) {
  return (
    <section id="dash-intro" className="scroll-mt-28 space-y-8 rounded-2xl border border-white/10 bg-black/20 p-6 sm:p-8">
      <div>
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-rose-300/90">Per te</p>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-300 sm:text-lg">{EMPATHY_PITCH}</p>
      </div>
      <HomeStripePricing
        sectionId="dashboard-piani"
        hideSectionTitle
        availability={hosted}
        payReady={payReady}
        basePlans={basePlans}
        coachAddOns={coachAddOns}
        trialPolicy={trialPolicy}
        trialDaysConfigured={trialDaysConfigured}
      />
    </section>
  );
}
