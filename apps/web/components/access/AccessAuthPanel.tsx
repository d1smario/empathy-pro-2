"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AccessMagicLinkForm } from "@/components/access/AccessMagicLinkForm";
import { AccessPasswordForm } from "@/components/access/AccessPasswordForm";
import type { PendingAppRole } from "@/lib/auth/pending-role-cookie";

type Mode = "password" | "otp";

type Props = {
  redirectAfterLogin: string;
};

/**
 * Accesso: email+password (default) oppure magic link.
 * `redirectAfterLogin` vale per login password (atleta) e per magic link quando `next` non è il default (es. `/access?next=/training/...`).
 * Magic link atleta con default → gate `/access/plan` (vedi `postOtpEmailRedirectNext`).
 */
export function AccessAuthPanel({ redirectAfterLogin }: Props) {
  const t = useTranslations("Access");
  const [mode, setMode] = useState<Mode>("password");
  const [appRole, setAppRole] = useState<PendingAppRole>("private");

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
        <p className="mb-2 text-center font-mono text-[0.55rem] uppercase tracking-[0.18em] text-gray-500">
          {t("accountTypeTitle")}
        </p>
        <div className="flex rounded-lg border border-white/10 bg-black/40 p-1">
          <button
            type="button"
            onClick={() => setAppRole("private")}
            className={`flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors ${
              appRole === "private" ? "bg-purple-600/40 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t("roleAthlete")}
          </button>
          <button
            type="button"
            onClick={() => setAppRole("coach")}
            className={`flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors ${
              appRole === "coach" ? "bg-purple-600/40 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t("roleCoach")}
          </button>
        </div>
        <p className="mt-2 text-center text-[0.65rem] leading-snug text-gray-500">
          {appRole === "coach" ? t("hintCoach") : t("hintAthlete")}
        </p>
      </div>
      <div className="flex rounded-xl border border-white/10 bg-black/40 p-1">
        <button
          type="button"
          onClick={() => setMode("password")}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
            mode === "password" ? "bg-purple-600/40 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {t("modePassword")}
        </button>
        <button
          type="button"
          onClick={() => setMode("otp")}
          className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors ${
            mode === "otp" ? "bg-purple-600/40 text-white" : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {t("modeMagicLink")}
        </button>
      </div>
      {mode === "password" ? (
        <AccessPasswordForm redirectAfterLogin={redirectAfterLogin} appRole={appRole} />
      ) : (
        <AccessMagicLinkForm redirectAfterLogin={redirectAfterLogin} appRole={appRole} />
      )}
    </div>
  );
}
