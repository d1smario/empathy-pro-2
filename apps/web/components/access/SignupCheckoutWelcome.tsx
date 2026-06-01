"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";

type EntitlementResponse = {
  ok?: boolean;
  hasAthleteAccess?: boolean;
  label?: string;
};

type SignupCheckoutWelcomeProps = {
  checkoutSessionId?: string | null;
  initialReady?: boolean;
  initialLabel?: string | null;
};

function entitlementUrl(sessionId?: string | null): string {
  const params = new URLSearchParams({ repair: "1" });
  const sid = sessionId?.trim();
  if (sid?.startsWith("cs_")) params.set("session_id", sid);
  return `/api/billing/entitlement?${params.toString()}`;
}

/**
 * Conferma post-checkout Stripe: sync entitlement + redirect automatico in dashboard.
 */
export function SignupCheckoutWelcome({
  checkoutSessionId,
  initialReady = false,
  initialLabel = null,
}: SignupCheckoutWelcomeProps) {
  const t = useTranslations("AccessPlan");
  const [ready, setReady] = useState(initialReady);
  const [label, setLabel] = useState<string | null>(initialLabel);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!ready || redirecting) return;
    setRedirecting(true);
    setSyncNote(t("welcomeRedirecting"));
    const timer = window.setTimeout(() => {
      window.location.assign("/dashboard?welcome=1");
    }, initialReady ? 800 : 1500);
    return () => window.clearTimeout(timer);
  }, [ready, redirecting, initialReady, t]);

  useEffect(() => {
    if (initialReady) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    async function pollEntitlement(): Promise<boolean> {
      try {
        const res = await fetch(entitlementUrl(checkoutSessionId), { cache: "no-store" });
        const data = (await res.json()) as EntitlementResponse;
        if (!cancelled && res.ok && data.ok && data.hasAthleteAccess) {
          setReady(true);
          setLabel(typeof data.label === "string" ? data.label : null);
          setSyncNote(null);
          return true;
        }
      } catch {
        /* retry */
      }
      return false;
    }

    async function loop() {
      if (cancelled || attempts >= maxAttempts) {
        if (!cancelled) {
          setSyncNote(t("welcomeSyncSlow"));
        }
        return;
      }
      attempts += 1;

      const entitled = await pollEntitlement();
      if (entitled || cancelled) return;

      window.setTimeout(loop, 1500);
    }

    void loop();
    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId, initialReady, t]);

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
        <p className="mt-4 text-xs text-gray-500">{syncNote ?? t("welcomeSyncing")}</p>
      ) : (
        <div className="mt-8 flex flex-wrap justify-center gap-3 sm:justify-start">
          <Pro2Button
            type="button"
            variant="primary"
            className="justify-center px-8"
            disabled={redirecting}
            onClick={() => {
              window.location.assign("/dashboard?welcome=1");
            }}
          >
            {redirecting ? t("welcomeRedirecting") : t("welcomeEnterDashboard")}
          </Pro2Button>
        </div>
      )}
    </section>
  );
}
