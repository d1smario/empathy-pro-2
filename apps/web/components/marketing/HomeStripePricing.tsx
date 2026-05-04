"use client";

import { useState } from "react";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";
import type { HostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import type {
  EmpathyBasePlanId,
  EmpathyCoachAddOnId,
  EmpathyPlanCatalogItem,
  EmpathyTrialPolicy,
} from "@empathy/contracts";
import { cn } from "@/lib/cn";

type HomeStripePricingProps = {
  availability: HostedCheckoutAvailability;
  /** Se false, il pagamento da questa UI non può completarsi (manca config server). */
  payReady?: boolean;
  basePlans: EmpathyPlanCatalogItem[];
  coachAddOns: EmpathyPlanCatalogItem[];
  trialPolicy: EmpathyTrialPolicy;
  trialDaysConfigured?: number;
  billingFlash?: "success" | "cancel";
  compactIntro?: boolean;
  /** In dashboard: niente titolo duplicato (c’è già la shell EMPATHY + intro). */
  hideSectionTitle?: boolean;
  sectionId?: string;
};

function planPriceConfigured(id: EmpathyBasePlanId, a: HostedCheckoutAvailability): boolean {
  if (id === "silver") return a.silver;
  if (id === "gold") return a.gold;
  return false;
}

function coachPriceConfigured(id: EmpathyCoachAddOnId, a: HostedCheckoutAvailability): boolean {
  if (id === "elite") return a.coachElite;
  if (id === "pro") return a.coachPro;
  if (id === "olimpic") return a.coachOlimpic;
  return false;
}

export function HomeStripePricing({
  availability,
  payReady = false,
  basePlans,
  coachAddOns,
  trialPolicy,
  trialDaysConfigured,
  billingFlash,
  compactIntro,
  hideSectionTitle,
  sectionId = "piani",
}: HomeStripePricingProps) {
  const [basePlanId, setBasePlanId] = useState<EmpathyBasePlanId>("silver");
  const [coachAddOnId, setCoachAddOnId] = useState<EmpathyCoachAddOnId | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<false | "subscribe" | "trial">(false);
  const [err, setErr] = useState<string | null>(null);

  const trialEligible =
    trialPolicy.eligiblePlanIds.includes(basePlanId) &&
    trialDaysConfigured != null &&
    trialDaysConfigured > 0;

  async function goCheckout(withTrial: boolean) {
    setErr(null);
    if (!payReady) {
      setErr(
        "Abbonamento online non ancora abilitato su questo ambiente. Chiedi al team di completare la configurazione oppure usa Access se hai già un account.",
      );
      return;
    }
    setLoading(withTrial ? "trial" : "subscribe");
    try {
      const res = await fetch("/api/billing/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basePlanId,
          ...(coachAddOnId ? { coachAddOnId } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          withTrial,
        }),
      });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        hint?: string;
        stripeKeyKind?: string;
      };
      if (!res.ok) {
        const parts = [data.error ?? `Errore ${res.status}`];
        if (data.stripeKeyKind) parts.push(`Chiave Stripe: ${data.stripeKeyKind}`);
        if (data.hint) parts.push(data.hint);
        setErr(parts.join(" — "));
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setErr("URL di pagamento non disponibile.");
    } catch {
      setErr("Richiesta non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  const showTitle = !hideSectionTitle && !compactIntro;

  return (
    <section id={sectionId} className="scroll-mt-24">
      {showTitle ? (
        <>
          <p className="text-2xl font-black tracking-[0.14em] text-white sm:text-3xl lg:text-4xl">EMPATHY</p>
          <h2 className="mt-1 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
            Pro 2.0
          </h2>
          <div className="mx-auto mt-4 h-px w-20 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 opacity-80" />
        </>
      ) : null}

      {billingFlash === "success" ? (
        <p
          className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          role="status"
        >
          Operazione completata. Puoi entrare in app da Access o dalla dashboard.
        </p>
      ) : null}
      {billingFlash === "cancel" ? (
        <p
          className="mt-6 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          role="status"
        >
          Pagamento non completato. Puoi riprovare quando vuoi.
        </p>
      ) : null}

      {!payReady ? (
        <p className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/90">
          Puoi sempre selezionare pacchetto e coach. Il pulsante di pagamento si attiva quando l&apos;ambiente è configurato
          per l&apos;abbonamento.
        </p>
      ) : null}

      <div className={cn("grid gap-5 lg:grid-cols-2", showTitle || billingFlash ? "mt-10" : "mt-2")}>
        {basePlans.map((plan) => {
          const pid = plan.id as EmpathyBasePlanId;
          const priceOk = planPriceConfigured(pid, availability);
          const selected = basePlanId === pid;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setBasePlanId(pid)}
              className={cn(
                "flex flex-col rounded-2xl border bg-white/[0.03] p-6 text-left backdrop-blur-md transition hover:border-white/20",
                plan.id === "gold" && "shadow-lg shadow-orange-500/10",
                selected
                  ? "border-purple-400/60 ring-2 ring-purple-500/40"
                  : plan.id === "gold"
                    ? "border-orange-400/35"
                    : "border-white/10",
              )}
            >
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-orange-300/90">{plan.label}</span>
              <span className="mt-2 text-4xl font-black text-white">
                {plan.monthlyPrice} €
                <span className="text-base font-semibold text-gray-500"> / mese</span>
              </span>
              <span className="mt-3 text-sm leading-relaxed text-gray-400">{plan.summary}</span>
              <ul className="mt-4 list-inside list-disc space-y-1.5 text-xs text-gray-500">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {selected ? (
                <span className="mt-4 text-xs font-medium text-purple-300">Selezionato</span>
              ) : (
                <span className="mt-4 text-xs text-gray-600">Clic per selezionare</span>
              )}
              {!priceOk && payReady ? (
                <span className="mt-2 text-xs text-amber-400/80">Prezzo non collegato in questo ambiente.</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-12">
        <h3 className="text-lg font-bold text-white">Coach performance (opzionale)</h3>
        <p className="mt-1 text-sm text-gray-500">Aggiungi un livello di supporto sul pacchetto scelto.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setCoachAddOnId(null)}
            className={cn(
              "rounded-2xl border p-4 text-left transition",
              coachAddOnId === null
                ? "border-purple-400/60 bg-purple-500/10 ring-2 ring-purple-500/30"
                : "border-white/10 bg-black/20 hover:border-white/20",
            )}
          >
            <span className="font-semibold text-white">Nessun coach</span>
            <p className="mt-2 text-xs leading-relaxed text-gray-500">Solo piattaforma e pacchetto base.</p>
          </button>
          {coachAddOns.map((a) => {
            const aid = a.id as EmpathyCoachAddOnId;
            const priceOk = coachPriceConfigured(aid, availability);
            const selected = coachAddOnId === aid;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setCoachAddOnId(aid)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition",
                  selected
                    ? "border-purple-400/60 bg-purple-500/10 ring-2 ring-purple-500/30"
                    : "border-white/10 bg-black/20 hover:border-white/20",
                )}
              >
                <span className="font-semibold text-white">{a.label}</span>
                <span className="mt-1 block text-sm text-gray-400">+{a.monthlyPrice} € / mese</span>
                <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-gray-500">
                  {a.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {!priceOk && payReady ? (
                  <p className="mt-2 text-xs text-amber-400/80">Add-on non collegato in questo ambiente.</p>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <label htmlFor="checkout-email" className="block text-xs font-medium text-gray-500">
          Email (opzionale)
        </label>
        <input
          id="checkout-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full max-w-md rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none ring-purple-500/30 placeholder:text-gray-600 focus:border-purple-500/40 focus:ring-2"
          placeholder="nome@esempio.it"
          disabled={loading !== false}
        />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Pro2Button
            type="button"
            variant="primary"
            className="justify-center px-8"
            disabled={loading !== false}
            onClick={() => goCheckout(false)}
          >
            {loading === "subscribe" ? "Reindirizzamento…" : "Abbonati e paga"}
          </Pro2Button>
          <Pro2Button
            type="button"
            variant="secondary"
            className="justify-center px-8"
            disabled={loading !== false || !trialEligible}
            onClick={() => goCheckout(true)}
            title={!trialEligible ? "Prova non attiva su questo ambiente o piano non idoneo." : undefined}
          >
            {loading === "trial" ? "Reindirizzamento…" : `Prova gratuita${trialDaysConfigured ? ` (${trialDaysConfigured} giorni)` : ""}`}
          </Pro2Button>
        </div>
        {trialDaysConfigured == null ? (
          <p className="mt-3 text-xs text-gray-600">In questo ambiente la prova gratuita non è attiva.</p>
        ) : null}
        {err ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <Pro2Link href="/access" variant="ghost" className="justify-center px-6">
            Ho già un account — Access
          </Pro2Link>
          <Pro2Link href="/dashboard" variant="ghost" className="justify-center px-6">
            Entra in app
          </Pro2Link>
        </div>
      </div>
    </section>
  );
}
