import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HomeStripePricing } from "@/components/marketing/HomeStripePricing";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2Link } from "@/components/ui/empathy";
import { getEmpathyAccountCatalog } from "@/lib/account/plan-catalog";
import { loadUserAccessEntitlement } from "@/lib/billing/access-entitlement";
import { checkoutPayReady, hostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import { readCheckoutTrialDays } from "@/lib/billing/stripe-checkout-trial";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abbonamento — Empathy Pro 2.0",
  robots: { index: false, follow: false },
};

/**
 * Gate post-registrazione atleta: prova gratuita (se configurata) o abbonamento Stripe.
 * Richiede sessione; coach → `/athletes`; già con accesso atleta → dashboard.
 */
export default async function AccessPlanPage() {
  if (!getSupabasePublicConfig()) {
    redirect("/access?error=config");
  }

  const sb = createSupabaseCookieClient();
  if (!sb) redirect("/access?error=config");

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    redirect("/access?next=%2Faccess%2Fplan");
  }

  const { data: prof } = await sb.from("app_user_profiles").select("role").eq("user_id", user.id).maybeSingle();
  const role = (prof as { role?: string } | null)?.role;
  if (role === "coach") {
    redirect("/athletes");
  }

  const entitlement = await loadUserAccessEntitlement(sb, user.id);
  if (entitlement.hasAthleteAccess) {
    redirect("/dashboard");
  }

  const catalog = getEmpathyAccountCatalog();
  const hosted = hostedCheckoutAvailability();
  const payReady = checkoutPayReady();
  const trialDaysConfigured = readCheckoutTrialDays();
  const t = await getTranslations("AccessPlan");

  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative mx-auto max-w-4xl scroll-mt-0 px-4 py-12 outline-none sm:px-6 sm:py-16"
      >
        <header className="mb-10 border-b border-white/10 pb-8 text-center sm:text-left">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-gray-500">{t("eyebrow")}</p>
          <h1 className="mt-3 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">{t("subtitle")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Pro2Link href="/access" variant="ghost" className="justify-center border border-white/15 text-gray-300">
              {t("backAccess")}
            </Pro2Link>
            <Pro2Link href="/dashboard" variant="secondary" className="justify-center border border-white/15">
              {t("skipIfAlready")}
            </Pro2Link>
          </div>
        </header>

        <HomeStripePricing
          availability={hosted}
          payReady={payReady}
          basePlans={catalog.basePlans}
          coachAddOns={catalog.coachAddOns}
          trialPolicy={catalog.trialPolicy}
          trialDaysConfigured={trialDaysConfigured}
          compactIntro
          hideSectionTitle
          sectionId="access-plan-checkout"
          prefillEmail={user.email ?? null}
        />
      </main>
    </BrutalistAppBackdrop>
  );
}
