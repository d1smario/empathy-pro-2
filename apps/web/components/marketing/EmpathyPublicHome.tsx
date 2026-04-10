import Link from "next/link";
import { EMPATHY_PLATFORM_VERSION } from "@empathy/contracts";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { getEmpathyAccountCatalog } from "@/lib/account/plan-catalog";
import { checkoutPayReady, hostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import { readCheckoutTrialDays } from "@/lib/billing/stripe-checkout-trial";
import { HomeStripePricing } from "./HomeStripePricing";

type EmpathyPublicHomeProps = {
  billingFlash?: "success" | "cancel";
  /** Pagina `/pricing`: stesso blocco piani, intestazione più corta. */
  variant?: "landing" | "pricing-page";
};

export function EmpathyPublicHome({ billingFlash, variant = "landing" }: EmpathyPublicHomeProps) {
  const catalog = getEmpathyAccountCatalog();
  const hosted = hostedCheckoutAvailability();
  const payReady = checkoutPayReady();
  const trialDaysConfigured = readCheckoutTrialDays();

  const pitch =
    "Empathy è una piattaforma di performance e physiology adaptation, capace di guidare l'adattamento attraverso timing, stimoli e nutrizione. Misurare il cambiamento e portarti alla vera performance.";

  return (
    <BrutalistAppBackdrop matrix={variant === "landing"}>
      <main
        id="main-content"
        tabIndex={-1}
        className="relative scroll-mt-0 px-6 py-16 outline-none sm:py-24"
      >
        <div className="relative mx-auto max-w-4xl">
          {variant === "landing" ? (
            <>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 px-4 py-2 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-purple-200 backdrop-blur-xl">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
                Athlete OS
              </div>
              <p className="text-4xl font-black tracking-[0.12em] text-white sm:text-5xl lg:text-6xl">EMPATHY</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                  Pro 2.0
                </span>
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg">{pitch}</p>
              <code className="mt-6 block w-fit rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-purple-200 backdrop-blur-xl">
                {EMPATHY_PLATFORM_VERSION}
              </code>

              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    t: "Reality first",
                    d: "Sensori, import e lab alimentano uno stato atleta canonico condiviso tra i moduli.",
                  },
                  {
                    t: "Motori + twin",
                    d: "Calcoli deterministici e twin digitale; l&apos;AI interpreta, orchestra ed evidenza.",
                  },
                  {
                    t: "Operatività",
                    d: "Builder, calendario, nutrizione e health consumano gli stessi contratti @empathy/contracts.",
                  },
                ].map((x) => (
                  <div
                    key={x.t}
                    className="rounded-2xl border border-white/10 bg-black/25 p-5 text-left backdrop-blur-md"
                  >
                    <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-cyan-300/90">{x.t}</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">{x.d}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
                <Link
                  href="#piani"
                  className="empathy-btn-gradient inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/30"
                >
                  Piani e abbonamento
                </Link>
                <Link
                  href="/access"
                  className="inline-flex items-center justify-center rounded-full border border-orange-500/35 bg-orange-500/10 px-8 py-3 text-sm font-medium text-orange-100 backdrop-blur-xl transition hover:border-orange-400/50"
                >
                  Accedi o registrati
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-3 text-sm font-medium text-gray-300 backdrop-blur-xl transition hover:border-purple-500/40"
                >
                  Vai all&apos;app
                </Link>
              </div>
            </>
          ) : (
            <header className="mb-10 border-b border-white/10 pb-8">
              <p className="text-3xl font-black tracking-[0.12em] text-white sm:text-4xl">EMPATHY</p>
              <h1 className="mt-2 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-5xl">
                Pro 2.0
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400">{pitch}</p>
              <p className="mt-3 text-sm text-gray-500">
                <Link href="/" className="text-pink-300 underline-offset-4 hover:underline">
                  Torna alla home
                </Link>
              </p>
            </header>
          )}

          <div className={variant === "landing" ? "mt-20 border-t border-white/10 pt-16" : ""}>
            <HomeStripePricing
              availability={hosted}
              payReady={payReady}
              basePlans={catalog.basePlans}
              coachAddOns={catalog.coachAddOns}
              trialPolicy={catalog.trialPolicy}
              trialDaysConfigured={trialDaysConfigured}
              billingFlash={billingFlash}
              compactIntro={variant === "pricing-page"}
            />
          </div>

          {variant === "landing" ? (
            <p className="mt-16 text-center text-xs text-gray-600">
              <Link href="/pricing" className="underline-offset-4 hover:text-gray-400 hover:underline">
                Link diretto /pricing
              </Link>
              {" · "}
              Dev: porta predefinita <code className="text-gray-500">3020</code> se usi <code className="text-gray-500">npm run dev</code>.
            </p>
          ) : null}
        </div>
      </main>
    </BrutalistAppBackdrop>
  );
}
