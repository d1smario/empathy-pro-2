"use client";

import { useState } from "react";
import { accessAppOriginFromWindow } from "@/lib/auth/access-app-origin";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button } from "@/components/ui/empathy";

type Props = {
  redirectAfterLogin: string;
};

function formatAuthErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) {
    return "Email o password non corretti. Se l’account esiste solo con magic link, crea una password da “Password dimenticata?” oppure usa la scheda Link email.";
  }
  if (m.includes("email not confirmed")) {
    return "Devi ancora confermare l’email (link da Supabase). In progetto di test puoi disattivare “Confirm email” in Authentication → Providers → Email.";
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
export function AccessPasswordForm({ redirectAfterLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [password2, setPassword2] = useState("");
  const [resetSent, setResetSent] = useState(false);

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setMsg("Supabase non configurato.");
      return;
    }
    const em = email.trim();
    if (!em || !password) {
      setMsg("Inserisci email e password.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: em, password });
    if (error) {
      setBusy(false);
      setMsg(formatAuthErrorMessage(error.message));
      return;
    }
    await supabase.auth.getSession();
    setBusy(false);
    const path = redirectAfterLogin.startsWith("/") ? redirectAfterLogin : `/${redirectAfterLogin}`;
    window.location.assign(path);
  }

  async function onSignUp(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setMsg("Supabase non configurato.");
      return;
    }
    const em = email.trim();
    if (!em || !password || password.length < 8) {
      setMsg("Email e password (min. 8 caratteri).");
      return;
    }
    if (password !== password2) {
      setMsg("Le password non coincidono.");
      return;
    }
    setBusy(true);
    const origin = accessAppOriginFromWindow();
    const { data, error } = await supabase.auth.signUp({
      email: em,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectAfterLogin)}`,
      },
    });
    setBusy(false);
    if (error) {
      setMsg(formatAuthErrorMessage(error.message));
      return;
    }
    if (data.session) {
      const path = redirectAfterLogin.startsWith("/") ? redirectAfterLogin : `/${redirectAfterLogin}`;
      window.location.assign(path);
      return;
    }
    setMsg("Controlla la posta per confermare l’account (se la conferma email è attiva in Supabase).");
  }

  async function onResetPassword() {
    setMsg(null);
    setResetSent(false);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setMsg("Supabase non configurato.");
      return;
    }
    const em = email.trim();
    if (!em) {
      setMsg("Inserisci l’email per ricevere il link di reset.");
      return;
    }
    setBusy(true);
    const origin = accessAppOriginFromWindow();
    const { error } = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectAfterLogin)}`,
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      setResetSent(true);
      setMsg("Se l’email è registrata, riceverai un link per reimpostare la password.");
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-md">
      {!showSignup ? (
        <form onSubmit={onSignIn} className="flex flex-col gap-3" aria-label="Accesso con email e password">
          <label className="text-left">
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
              placeholder="nome@esempio.it"
            />
          </label>
          <label className="text-left">
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-purple-500/50 focus:outline-none"
              placeholder="••••••••"
            />
          </label>
          <Pro2Button type="submit" disabled={busy} className="w-full justify-center">
            {busy ? "Accesso…" : "Accedi"}
          </Pro2Button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onResetPassword()}
            className="text-center text-xs font-medium text-cyan-300/90 underline-offset-2 hover:underline"
          >
            Password dimenticata?
          </button>
        </form>
      ) : (
        <form onSubmit={onSignUp} className="flex flex-col gap-3" aria-label="Registrazione con email e password">
          <p className="text-center text-xs text-gray-400">Crea account (stessa email che usi per Empathy).</p>
          <label className="text-left">
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">Email</span>
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
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">Password</span>
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
            <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">Ripeti password</span>
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
            {busy ? "Registrazione…" : "Registrati"}
          </Pro2Button>
        </form>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setShowSignup((v) => !v);
          setMsg(null);
          setResetSent(false);
        }}
        className="text-center text-xs text-gray-500 hover:text-gray-300"
      >
        {showSignup ? "Ho già un account — torna ad accedi" : "Prima volta? Crea un account con password"}
      </button>

      {msg ? (
        <p
          className={`text-center text-xs leading-relaxed ${resetSent || msg.includes("Controlla la posta") ? "text-emerald-300/90" : "text-amber-300/90"}`}
          role="status"
        >
          {msg}
        </p>
      ) : null}
    </div>
  );
}
