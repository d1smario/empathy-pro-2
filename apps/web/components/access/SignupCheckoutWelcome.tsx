"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pro2Button } from "@/components/ui/empathy";

type EntitlementResponse = {
  ok?: boolean;
  hasAthleteAccess?: boolean;
  label?: string;
};

type SyncResponse = {
  ok?: boolean;
  synced?: boolean;
  hasAthleteAccess?: boolean;
  label?: string;
  reason?: string | null;
};

type SignupCheckoutWelcomeProps = {
  checkoutSessionId?: string | null;
  initialReady?: boolean;
  initialLabel?: string | null;
};

/**
 * Conferma post-checkout Stripe (gate `/access/plan`): sync immediato + poll entitlement.
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

  useEffect(() => {
    if (initialReady) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;

    async function trySync(): Promise<boolean> {
      const sid = checkoutSessionId?.trim();
      if (!sid || !sid.startsWith("cs_")) return false;
      try {
        const res = await fetch("/api/billing/sync-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
        });
        const data = (await res.json()) as SyncResponse;
        if (!cancelled && res.ok && data.ok && data.hasAthleteAccess) {
          setReady(true);
          setLabel(typeof data.label === "string" ? data.label : null);
          setSyncNote(null);
          return true;
        }
        if (!cancelled && res.ok && data.ok && !data.synced && data.reason) {
          setSyncNote(t("welcomeSyncRetry"));
        }
      } catch {
        /* poll continues */
      }
      return false;
    }

    async function pollEntitlement(): Promise<boolean> {
      try {
        const res = await fetch("/api/billing/entitlement", { cache: "no-store" });
        const data = (await res.json()) as EntitlementResponse;
        if (!cancelled && res.ok && data.ok && data.hasAthleteAccess) {
          setReady(true);
          setLabel(typeof data.label === "string" ? data.label : null);
          return true;
        }
      } catch {
        /* retry */
      }
      return false;
    }

    async function loop() {
      if (cancelled || attempts >= maxAttempts) {
        if (!cancelled && !ready) {
          setSyncNote(t("welcomeSyncSlow"));
        }
        return;
      }
      attempts += 1;

      if (attempts === 1) {
        const synced = await trySync();
        if (synced) return;
      } else if (attempts % 4 === 0 && checkoutSessionId) {
        const synced = await trySync();
        if (synced) return;
      }

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
