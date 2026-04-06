"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type IntegrationFlagsPayload = {
  ok: true;
  integrations: {
    supabase: boolean;
    stripeSecret: boolean;
    stripePublishable: boolean;
    stripeWebhook: boolean;
    stripePriceSilver: boolean;
    stripePriceGold: boolean;
    stripeCoachPriceElite: boolean;
    stripeCoachPricePro: boolean;
    stripeCoachPriceOlimpic: boolean;
    stripePaymentLinkPublic: boolean;
    stripeCheckoutAnonEnabled: boolean;
    logmeal: boolean;
    spline: boolean;
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/**
 * Flag presenza integrazioni da `GET /api/settings/integration-flags` — nessun valore sensibile.
 */
export function SettingsIntegrationsDiagnostics() {
  const [data, setData] = useState<IntegrationFlagsPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/integration-flags", { cache: "no-store" });
        const json = (await res.json()) as IntegrationFlagsPayload | { ok?: false };
        if (cancelled) return;
        if (!res.ok || !("ok" in json) || json.ok !== true) {
          setErr("Impossibile leggere i flag integrazioni.");
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
      aria-label="Diagnostica integrazioni"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500/80 via-blue-500/80 to-violet-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-cyan-300">
          Integrazioni · presenza env
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Solo Sì/No (nessun segreto). Endpoint:{" "}
          <code className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-xs text-pink-300">
            /api/settings/integration-flags
          </code>
        </p>
        <p className="mt-1 text-[0.65rem] text-gray-600">
          In produzione, per il dump JSON con Bearer usa{" "}
          <code className="text-gray-500">/api/integrations/status</code> e{" "}
          <code className="text-gray-500">INTEGRATIONS_STATUS_SECRET</code>.
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
            <Row label="Supabase (URL + anon key)">
              <BoolPill value={data.integrations.supabase} />
            </Row>
            <Row label="Stripe · secret server">
              <BoolPill value={data.integrations.stripeSecret} />
            </Row>
            <Row label="Stripe · publishable (client)">
              <BoolPill value={data.integrations.stripePublishable} />
            </Row>
            <Row label="Stripe · webhook secret">
              <BoolPill value={data.integrations.stripeWebhook} />
            </Row>
            <Row label="Stripe · price Silver">
              <BoolPill value={data.integrations.stripePriceSilver} />
            </Row>
            <Row label="Stripe · price Gold">
              <BoolPill value={data.integrations.stripePriceGold} />
            </Row>
            <Row label="Stripe · price Coach Elite">
              <BoolPill value={data.integrations.stripeCoachPriceElite} />
            </Row>
            <Row label="Stripe · price Coach Pro">
              <BoolPill value={data.integrations.stripeCoachPricePro} />
            </Row>
            <Row label="Stripe · price Coach Olimpic">
              <BoolPill value={data.integrations.stripeCoachPriceOlimpic} />
            </Row>
            <Row label="Payment link pubblico">
              <BoolPill value={data.integrations.stripePaymentLinkPublic} />
            </Row>
            <Row label="Checkout anonimo abilitato">
              <BoolPill value={data.integrations.stripeCheckoutAnonEnabled} />
            </Row>
            <Row label="LogMeal">
              <BoolPill value={data.integrations.logmeal} />
            </Row>
            <Row label="Spline">
              <BoolPill value={data.integrations.spline} />
            </Row>
          </div>
        ) : null}
      </div>
    </section>
  );
}
