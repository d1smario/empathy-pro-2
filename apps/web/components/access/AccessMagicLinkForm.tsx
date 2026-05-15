"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { accessAppOriginFromWindow } from "@/lib/auth/access-app-origin";
import { setPendingAppRoleCookieClient } from "@/lib/auth/pending-app-role-client";
import type { PendingAppRole } from "@/lib/auth/pending-role-cookie";
import { postOtpEmailRedirectNext } from "@/lib/auth/post-registration-redirects";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button } from "@/components/ui/empathy";

type Props = {
  /** Path interno post-login (già validato lato server su `/access`). */
  redirectAfterLogin: string;
  appRole: PendingAppRole;
};

type MsgTone = "success" | "warning";

/**
 * Magic link email (Supabase Auth). Redirect configurato in dashboard + `/auth/callback`.
 */
export function AccessMagicLinkForm({ redirectAfterLogin, appRole }: Props) {
  const t = useTranslations("AccessForm");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<MsgTone>("warning");
  const [busy, setBusy] = useState(false);

  function notify(text: string, tone: MsgTone = "warning") {
    setMsg(text);
    setMsgTone(tone);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      notify(t("msgSupabaseMissingPublicKeys"));
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      notify(t("msgEnterEmail"));
      return;
    }
    setBusy(true);
    setPendingAppRoleCookieClient(appRole);
    const origin = accessAppOriginFromWindow();
    const otpNext = postOtpEmailRedirectNext(redirectAfterLogin, appRole);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(otpNext)}`,
      },
    });
    setBusy(false);
    if (error) {
      const em = error.message.toLowerCase();
      if (
        em.includes("redirect") &&
        (em.includes("not allowed") || em.includes("disallowed") || em.includes("url"))
      ) {
        notify(t("errRedirectNotAllowedMobile"));
        return;
      }
      if (em.includes("invalid api key") || em.includes("invalid api")) {
        notify(t("errSupabaseKeysShort"));
        return;
      }
      notify(error.message);
    } else {
      notify(t("msgMagicLinkSent"), "success");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-md"
      aria-label={t("ariaMagicLink")}
    >
      <label className="text-left">
        <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">
          {t("fieldEmail")}
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
          placeholder={t("emailPlaceholder")}
        />
      </label>
      <Pro2Button type="submit" disabled={busy} className="w-full justify-center">
        {busy ? t("btnMagicLinkBusy") : t("btnMagicLink")}
      </Pro2Button>
      {msg ? (
        <p
          className={`text-center text-xs leading-relaxed ${msgTone === "success" ? "text-emerald-300/90" : "text-amber-300/90"}`}
          role="status"
        >
          {msg}
        </p>
      ) : null}
    </form>
  );
}
