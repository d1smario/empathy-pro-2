import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HomeStripePricing } from "@/components/marketing/HomeStripePricing";
import { SignupCheckoutWelcome } from "@/components/access/SignupCheckoutWelcome";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2Link } from "@/components/ui/empathy";
import { getEmpathyAccountCatalog } from "@/lib/account/plan-catalog";
import { checkoutPayReady, hostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import { readCheckoutTrialDays } from "@/lib/billing/stripe-checkout-trial";
import { ensureBillingEntitlementForAuthUser } from "@/lib/billing/ensure-billing-entitlement";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Abbonamento — Empathy Pro 2.0",
  robots: { index: false, follow: false },
};

/**
 * Gate post-registrazione atleta: prova gratuita (se configurata) o abbonamento Stripe.
 * Richiede sessione; coach → `/athletes`; già con accesso atleta → dashboard.
 */
export default async function AccessPlanPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
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

  const isCheckoutSuccess = firstSearchParam(searchParams?.billing) === "success";
  const checkoutSessionId = firstSearchParam(searchParams?.session_id);

  const entitlement = await ensureBillingEntitlementForAuthUser(user.id, user.email ?? null, {
    checkoutSessionId,
    repairFromStripe: true,
  });

  if (entitlement.hasAthleteAccess && isCheckoutSuccess) {
    redirect("/dashboard?welcome=1");
  }

  if (entitlement.hasAthleteAccess && !isCheckoutSuccess) {
    redirect("/dashboard");
  }

  const catalog = getEmpathyAccountCatalog();
  const hosted = hostedCheckoutAvailability();
  const payReady = checkoutPayReady();
  const trialDaysConfigured = readCheckoutTrialDays();
  const t = await getTranslations("AccessPlan");
  const billingFlash =
    searchParams?.billing === "success"
      ? ("success" as const)
      : searchParams?.billing === "cancel"
        ? ("cancel" as const)
        : undefined;
  const showRequired =
    typeof searchParams?.required === "string" && searchParams.required === "subscription";

  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative mx-auto max-w-4xl scroll-mt-0 px-4 py-12 outline-none sm:px-6 sm:py-16"
      >
        <header className="mb-10 border-b border-white/10 pb-8 text-center sm:text-left">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-gray-500">
            {isCheckoutSuccess ? t("welcomeEyebrow") : t("eyebrow")}
          </p>
          <h1 className="mt-3 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
            {isCheckoutSuccess ? t("welcomeTitle") : t("title")}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">
            {isCheckoutSuccess ? t("welcomeBody") : t("subtitle")}
          </p>
          {showRequired && !isCheckoutSuccess ? (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
              {t("requiredAlert")}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
            <Pro2Link href="/access" variant="ghost" className="justify-center border border-white/15 text-gray-300">
              {t("backAccess")}
            </Pro2Link>
          </div>
        </header>

        {isCheckoutSuccess ? (
          <SignupCheckoutWelcome
            checkoutSessionId={checkoutSessionId ?? null}
            initialReady={entitlement.hasAthleteAccess}
            initialLabel={entitlement.hasAthleteAccess ? entitlement.label : null}
          />
        ) : (
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
            signupCheckoutGate
            billingFlash={billingFlash}
          />
        )}
      </main>
    </BrutalistAppBackdrop>
  );
}
