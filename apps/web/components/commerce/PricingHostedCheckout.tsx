"use client";

import { useMemo, useState } from "react";
import { ModeSelect, Pro2Button, type ModeSelectOption } from "@/components/ui/empathy";
import type { HostedCheckoutAvailability } from "@/lib/billing/stripe-checkout-availability";
import type { EmpathyBasePlanId, EmpathyCoachAddOnId } from "@empathy/contracts";

type PricingHostedCheckoutProps = {
  availability: HostedCheckoutAvailability;
};

const COACH_NONE = "__none__" as const;

/**
 * Abbonamento Silver/Gold via Stripe Checkout (API anonima gated da env server).
 */
export function PricingHostedCheckout({ availability }: PricingHostedCheckoutProps) {
  const [email, setEmail] = useState("");
  const [coachAddon, setCoachAddon] = useState<string>(COACH_NONE);
  const [loading, setLoading] = useState<false | EmpathyBasePlanId>(false);
  const [err, setErr] = useState<string | null>(null);

  const coachOptions = useMemo((): ModeSelectOption[] => {
    const opts: ModeSelectOption[] = [{ value: COACH_NONE, label: "Nessun add-on coach" }];
    if (availability.coachElite) opts.push({ value: "elite", label: "Coach Elite" });
    if (availability.coachPro) opts.push({ value: "pro", label: "Coach Pro" });
    if (availability.coachOlimpic) opts.push({ value: "olimpic", label: "Coach Olimpic" });
    return opts;
  }, [availability.coachElite, availability.coachPro, availability.coachOlimpic]);

  const hasCoachSelect = coachOptions.length > 1;

  if (!availability.silver && !availability.gold) {
    return null;
  }

  async function go(plan: EmpathyBasePlanId) {
    setErr(null);
    setLoading(plan);
    const coachPayload: { coachAddOnId?: EmpathyCoachAddOnId } = {};
    if (coachAddon !== COACH_NONE) {
      if (coachAddon === "elite" || coachAddon === "pro" || coachAddon === "olimpic") {
        coachPayload.coachAddOnId = coachAddon;
      }
    }
    try {
      const res = await fetch("/api/billing/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basePlanId: plan,
          ...coachPayload,
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setErr(data.error ?? `Errore ${res.status}`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setErr("URL checkout mancante.");
    } catch {
      setErr("Richiesta non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left"
      aria-label="Abbonamento Stripe Checkout"
    >
      <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-300">
        Abbonamento
      </p>
      <p className="mt-2 text-sm text-gray-400">
        Silver / Gold + add-on coach opzionali (stessi Price ID di V1). Richiede{" "}
        <code className="rounded border border-white/10 bg-black/40 px-1 py-0.5 font-mono text-xs text-pink-300">
          STRIPE_CHECKOUT_ANON_ENABLED=1
        </code>{" "}
        sul server — solo demo/staging senza auth.
      </p>
      {hasCoachSelect ? (
        <ModeSelect
          id="checkout-coach-addon"
          className="mt-5 max-w-sm"
          label="Add-on coach"
          value={coachAddon}
          onChange={setCoachAddon}
          options={coachOptions}
          disabled={loading !== false}
        />
      ) : null}
      <label htmlFor="checkout-email" className="mt-4 block text-xs font-medium text-gray-500">
        Email (opzionale, precompila Stripe)
      </label>
      <input
        id="checkout-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-1.5 w-full max-w-sm rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none ring-purple-500/30 placeholder:text-gray-600 focus:border-purple-500/40 focus:ring-2"
        placeholder="nome@esempio.it"
        disabled={loading !== false}
      />
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {availability.silver ? (
          <Pro2Button
            type="button"
            variant="secondary"
            className="justify-center px-8"
            disabled={loading !== false}
            onClick={() => go("silver")}
          >
            {loading === "silver" ? "Caricamento…" : "Silver"}
          </Pro2Button>
        ) : null}
        {availability.gold ? (
          <Pro2Button
            type="button"
            variant="secondary"
            className="justify-center px-8"
            disabled={loading !== false}
            onClick={() => go("gold")}
          >
            {loading === "gold" ? "Caricamento…" : "Gold"}
          </Pro2Button>
        ) : null}
      </div>
      {err ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}
    </section>
  );
}
