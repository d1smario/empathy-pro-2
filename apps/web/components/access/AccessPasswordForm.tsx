"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { accessAppOriginFromWindow } from "@/lib/auth/access-app-origin";
import { clearPendingAppRoleCookieClient, setPendingAppRoleCookieClient } from "@/lib/auth/pending-app-role-client";
import type { PendingAppRole } from "@/lib/auth/pending-role-cookie";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { resolvePostLoginDestination } from "@/lib/auth/post-login-destination";
import { isMobileBrowserClient } from "@/lib/shell/mobile-detect";
import { ACCESS_POST_SIGNUP_PLAN_PATH, postSignupRegistrationPath } from "@/lib/auth/post-registration-redirects";
import { Pro2Button } from "@/components/ui/empathy";

type Props = {
  redirectAfterLogin: string;
  appRole: PendingAppRole;
};

type MsgTone = "info" | "success" | "warning";

type AccessFormTranslator = (key: string) => string;

function formatAuthErrorMessage(t: AccessFormTranslator, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid api key") || m.includes("invalid api")) {
    return t("errSupabaseKeysClient");
  }
  if (m.includes("redirect") && (m.includes("not allowed") || m.includes("disallowed") || m.includes("url"))) {
    return t("errRedirectNotAllowed");
  }
  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
    return t("errInvalidCredentials");
  }
  if (m.includes("email not confirmed")) {
    return t("errEmailNotConfirmed");
  }
  if (
    m.includes("already registered") ||
    m.includes("already been registered") ||
    m.includes("user already exists")
  ) {
    return t("errAlreadyRegistered");
  }
  return message;
}

/**
 * Accesso Supabase con email + password (`signInWithPassword`).
 * Richiede che in Dashboard → Authentication → Providers → Email sia abilitato “Email” con password (non solo magic link).
 *
 * Dopo il login usiamo `window.location.assign` (navigazione completa) così i cookie impostati da `@supabase/ssr`
 * sono inclusi nella richiesta successiva: `router.replace` da solo può far vedere al middleware una sessione
 * ancora assente su Vercel.
 */

async function bootstrapProfileAfterSession(appRole: PendingAppRole): Promise<boolean> {
  const supabase = createEmpathyBrowserSupabase();
  if (!supabase) return false;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const u = session?.user;
  if (!u?.id) return false;
  const { data: existingProfile } = await supabase
    .from("app_user_profiles")
    .select("role")
    .eq("user_id", u.id)
    .maybeSingle();
  const storedRole = (existingProfile as { role?: PendingAppRole } | null)?.role;
  const roleForBootstrap: PendingAppRole = storedRole === "coach" ? "coach" : appRole;
  const meta = u.user_metadata as Record<string, unknown>;
  const res = await fetch("/api/access/ensure-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      userId: u.id,
      role: roleForBootstrap,
      email: u.email ?? null,
      firstName: typeof meta?.first_name === "string" ? meta.first_name : null,
      lastName: typeof meta?.last_name === "string" ? meta.last_name : null,
    }),
  });
  return res.ok;
}

export function AccessPasswordForm({ redirectAfterLogin, appRole }: Props) {
  const t = useTranslations("AccessForm");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<MsgTone>("warning");
  const [busy, setBusy] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [password2, setPassword2] = useState("");

  function notify(text: string, tone: MsgTone = "warning") {
    setMsg(text);
    setMsgTone(tone);
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      notify(t("msgSupabaseMissing"));
      return;
    }
    const em = email.trim();
    if (!em || !password) {
      notify(t("msgEnterEmailAndPassword"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) {
      setBusy(false);
      notify(formatAuthErrorMessage(t, error.message));
      return;
    }
    const bootOk = await bootstrapProfileAfterSession(appRole);
    if (!bootOk) {
      setBusy(false);
      notify(t("msgProfileBootstrapFailed"));
      return;
    }
    clearPendingAppRoleCookieClient();
    setBusy(false);
    const supabaseAfter = createEmpathyBrowserSupabase();
    let redirectRole: PendingAppRole = appRole;
    if (supabaseAfter) {
      const {
        data: { session },
      } = await supabaseAfter.auth.getSession();
      const uid = session?.user?.id;
      if (uid) {
        const { data: prof } = await supabaseAfter
          .from("app_user_profiles")
          .select("role")
          .eq("user_id", uid)
          .maybeSingle();
        if ((prof as { role?: PendingAppRole } | null)?.role === "coach") redirectRole = "coach";
      }
    }
    let hasAthleteAccess = false;
    let hasOperatorAccess = false;
    if (redirectRole !== "coach") {
      try {
        const entRes = await fetch("/api/billing/entitlement?repair=1", { cache: "no-store" });
        const ent = (await entRes.json()) as {
          ok?: boolean;
          hasAthleteAccess?: boolean;
          hasOperatorAccess?: boolean;
        };
        if (entRes.ok && ent.ok) {
          hasAthleteAccess = Boolean(ent.hasAthleteAccess);
          hasOperatorAccess = Boolean(ent.hasOperatorAccess);
        }
      } catch {
        /* gate piano se entitlement non leggibile */
      }
    } else {
      hasOperatorAccess = true;
    }
    const target = resolvePostLoginDestination({
      next: redirectAfterLogin,
      appRole: redirectRole,
      hasAthleteAccess,
      hasOperatorAccess,
      preferMobile: isMobileBrowserClient(),
    });
    window.location.assign(target);
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      notify(t("msgSupabaseMissing"));
      return;
    }
    const em = email.trim();
    if (!em || !password || password.length < 8) {
      notify(t("msgEmailPasswordMin8"));
      return;
    }
    if (password !== password2) {
      notify(t("msgPasswordsMismatch"));
      return;
    }
    setBusy(true);
    setPendingAppRoleCookieClient(appRole);
    const origin = accessAppOriginFromWindow();
    const signupNext = postSignupRegistrationPath(appRole);
    const { data, error } = await supabase.auth.signUp({
      email: em,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(signupNext)}`,
      },
    });
    setBusy(false);
    if (error) {
      notify(formatAuthErrorMessage(t, error.message));
      return;
    }
    if (data.session) {
      await bootstrapProfileAfterSession(appRole);
      clearPendingAppRoleCookieClient();
      window.location.assign(postSignupRegistrationPath(appRole));
      return;
    }
    notify(t("msgConfirmEmailSent"), "success");
  }

  async function onResetPassword() {
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      notify(t("msgSupabaseMissing"));
      return;
    }
    const em = email.trim();
    if (!em) {
      notify(t("msgEnterEmailForReset"));
      return;
    }
    setBusy(true);
    const origin = accessAppOriginFromWindow();
    /** Dopo il click sul link, `auth/callback` scambia il `code` e reindirizza qui per `updateUser({ password })`. */
    const { error } = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/set-password")}`,
    });
    setBusy(false);
    if (error) notify(error.message);
    else notify(t("msgResetSent"), "success");
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
      {!showSignup ? (
        <form onSubmit={onSignIn} className="flex flex-col gap-3" aria-label={t("ariaSignIn")}>
          <label className="text-left">
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{t("fieldEmail")}</span>
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
          <label className="text-left">
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{t("fieldPassword")}</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
              placeholder={t("passwordPlaceholder")}
            />
          </label>
          <Pro2Button type="submit" disabled={busy} className="w-full justify-center">
            {busy ? t("btnSignInBusy") : t("btnSignIn")}
          </Pro2Button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onResetPassword()}
            className="text-center text-xs font-medium text-cyan-300/90 underline-offset-2 hover:underline"
          >
            {t("forgotPassword")}
          </button>
        </form>
      ) : (
        <form onSubmit={onSignUp} className="flex flex-col gap-3" aria-label={t("ariaSignUp")}>
          <p className="text-center text-xs text-gray-400">{t("signUpIntro")}</p>
          <label className="text-left">
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{t("fieldEmail")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
            />
          </label>
          <label className="text-left">
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{t("fieldPassword")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
            />
          </label>
          <label className="text-left">
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">{t("fieldRepeatPassword")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-purple-500/50 focus:outline-none"
            />
          </label>
          <Pro2Button type="submit" disabled={busy} className="w-full justify-center">
            {busy ? t("btnSignUpBusy") : t("btnSignUp")}
          </Pro2Button>
        </form>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setShowSignup((v) => !v);
          setMsg(null);
        }}
        className="text-center text-xs text-gray-500 hover:text-gray-300"
      >
        {showSignup ? t("switchToSignIn") : t("switchToSignUp")}
      </button>

      {msg ? (
        <p
          className={`text-center text-xs leading-relaxed ${msgTone === "success" ? "text-emerald-300/90" : "text-amber-300/90"}`}
          role="status"
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
