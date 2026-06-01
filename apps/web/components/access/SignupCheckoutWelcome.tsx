"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";

type EntitlementResponse = {
  ok?: boolean;
  hasAthleteAccess?: boolean;
  label?: string;
};

/**
 * Conferma post-checkout Stripe (gate `/access/plan`): messaggio benvenuto + sync entitlement.
 */
export function SignupCheckoutWelcome() {
  const t = useTranslations("AccessPlan");
  const [ready, setReady] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 20;

    async function poll() {
      if (cancelled || attempts >= maxAttempts) return;
      attempts += 1;
      try {
        const res = await fetch("/api/billing/entitlement", { cache: "no-store" });
        const data = (await res.json()) as EntitlementResponse;
        if (!cancelled && res.ok && data.ok && data.hasAthleteAccess) {
          setReady(true);
          setLabel(typeof data.label === "string" ? data.label : null);
          return;
        }
      } catch {
        /* retry */
      }
      if (!cancelled) {
        window.setTimeout(poll, 1500);
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/10 via-purple-500/5 to-orange-500/5 p-8 text-center sm:text-left"
      aria-live="polite"
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.28em] text-emerald-300/90">{t("welcomeEyebrow")}</p>
      <h2 className="mt-3 bg-gradient-to-r from-purple-300 via-pink-300 to-orange-300 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
        {t("welcomeTitle")}
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-300">{t("welcomeBody")}</p>
      {label ? <p className="mt-2 text-xs text-emerald-200/90">{label}</p> : null}
      {!ready ? (
        <p className="mt-4 text-xs text-gray-500">{t("welcomeSyncing")}</p>
      ) : (
        <div className="mt-8 flex flex-wrap justify-center gap-3 sm:justify-start">
          <Pro2Button
            type="button"
            variant="primary"
            className="justify-center px-8"
            onClick={() => {
              window.location.assign("/dashboard?welcome=1");
            }}
          >
            {t("welcomeEnterDashboard")}
          </Pro2Button>
        </div>
      )}
    </section>
  );
}
