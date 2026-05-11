"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useAthleteContext } from "@/core";
import { Pro2Link } from "@/components/ui/empathy";

/**
 * Blocca il contenuto modulo finché non c'è un atleta attivo (contesto Supabase + storage coerente).
 * Non usare su `/profile` o `/dashboard` (bootstrap / hub).
 */
export function Pro2AthleteRequiredGate({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const { athleteId, loading, signedIn, role } = useAthleteContext();
  const t = useTranslations("AthleteGate");

  if (!enabled) return <>{children}</>;

  if (!signedIn) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-slate-400">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" aria-hidden />
        <p>{t("loadingContext")}</p>
      </div>
    );
  }

  if (!athleteId) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/35 bg-amber-950/20 px-6 py-8 text-center text-sm text-slate-200">
        <p className="text-base font-semibold text-amber-100">{t("noActiveTitle")}</p>
        <p className="mt-3 leading-relaxed text-slate-400">
          {role === "coach" ? t("noActiveCoach") : t("noActiveAthlete")}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Pro2Link href="/profile" variant="primary" className="justify-center">
            {t("goToProfile")}
          </Pro2Link>
          <Pro2Link href="/dashboard" variant="secondary" className="justify-center border border-white/15">
            {t("goToDashboard")}
          </Pro2Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
