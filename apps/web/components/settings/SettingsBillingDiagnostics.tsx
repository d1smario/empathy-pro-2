"use client";

import { useEffect, useState } from "react";
import { Pro2Link } from "@/components/ui/empathy";

type StripeKeyKind = "live" | "test" | "restricted" | "unknown";

type CheckoutConfigPayload = {
  ok: true;
  webhookPath: string;
  anonCheckoutEnabled: boolean;
  stripeSecretConfigured?: boolean;
  stripeKeyKind?: StripeKeyKind;
  paymentLinkConfigured: boolean;
  webhookSecretConfigured: boolean;
  trialConfigured: boolean;
  trialDays: number | null;
  hosted: {
    silver: boolean;
    gold: boolean;
    coachElite: boolean;
    coachPro: boolean;
    coachOlimpic: boolean;
  };
};

function BoolPill({ value }: { value: boolean }) {
  return (
    <span
      className={
        value
          ? "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-200"
          : "rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-gray-500"
      }
    >
      {value ? "Sì" : "No"}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Solo flag pubblici da `GET /api/billing/checkout-config` — nessun segreto in pagina.
 */
export function SettingsBillingDiagnostics() {
  const [data, setData] = useState<CheckoutConfigPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/checkout-config", { cache: "no-store" });
        const json = (await res.json()) as CheckoutConfigPayload | { ok?: false; error?: string };
        if (cancelled) return;
        if (!res.ok || !("ok" in json) || json.ok !== true) {
          setErr("Impossibile leggere la configurazione billing.");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setErr("Richiesta non riuscita.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Diagnostica billing"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500/80 via-pink-500/80 to-orange-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-orange-300">
          Billing · Stripe
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Stato locale (env) senza esporre chiavi. Endpoint:{" "}
          <code className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-xs text-pink-300">
            /api/billing/checkout-config
          </code>
        </p>

        {err ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        {!err && !data ? (
          <div className="mt-6 space-y-2">
            <div className="h-2 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="h-2 w-56 animate-pulse rounded-full bg-white/10" />
          </div>
        ) : null}

        {data ? (
          <div className="mt-6 font-mono text-xs">
            <Row label="Checkout anonimo abilitato (STRIPE_CHECKOUT_ANON_ENABLED)">
              <BoolPill value={data.anonCheckoutEnabled} />
            </Row>
            <Row label="STRIPE_SECRET_KEY presente">
              <BoolPill value={data.stripeSecretConfigured ?? false} />
            </Row>
            <Row label="Modalità chiave Stripe (prefisso)">
              <span className="text-gray-300">{data.stripeKeyKind ?? "—"}</span>
            </Row>
            <Row label="Payment link pubblico">
              <BoolPill value={data.paymentLinkConfigured} />
            </Row>
            <Row label="Webhook secret configurato">
              <BoolPill value={data.webhookSecretConfigured} />
            </Row>
            <Row label="Trial checkout configurato">
              <span className="flex items-center gap-2">
                <BoolPill value={data.trialConfigured} />
                {data.trialDays != null ? (
                  <span className="text-gray-500">({data.trialDays} gg)</span>
                ) : null}
              </span>
            </Row>
            <Row label="Hosted · Silver">
              <BoolPill value={data.hosted.silver} />
            </Row>
            <Row label="Hosted · Gold">
              <BoolPill value={data.hosted.gold} />
            </Row>
            <Row label="Hosted · Coach Elite">
              <BoolPill value={data.hosted.coachElite} />
            </Row>
            <Row label="Hosted · Coach Pro">
              <BoolPill value={data.hosted.coachPro} />
            </Row>
            <Row label="Hosted · Coach Olimpic">
              <BoolPill value={data.hosted.coachOlimpic} />
            </Row>
            <p className="mt-4 text-[0.65rem] text-gray-600">
              Webhook path: <span className="text-gray-400">{data.webhookPath}</span>
            </p>
          </div>
        ) : null}

        <div className="mt-8 border-t border-white/10 pt-6">
          <Pro2Link href="/pricing" variant="secondary" className="justify-center">
            Apri pricing
          </Pro2Link>
        </div>
      </div>
    </section>
  );
}
