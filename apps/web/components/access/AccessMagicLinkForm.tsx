"use client";

import { useState } from "react";
import { accessAppOriginFromWindow } from "@/lib/auth/access-app-origin";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button } from "@/components/ui/empathy";

type Props = {
  /** Path interno post-login (già validato lato server su `/access`). */
  redirectAfterLogin: string;
};

/**
 * Magic link email (Supabase Auth). Redirect configurato in dashboard + `/auth/callback`.
 */
export function AccessMagicLinkForm({ redirectAfterLogin }: Props) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setMsg("Supabase non configurato: mancano NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      setMsg("Inserisci un indirizzo email.");
      return;
    }
    setBusy(true);
    const origin = accessAppOriginFromWindow();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(redirectAfterLogin)}`,
      },
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else setMsg("Controlla la posta: ti abbiamo inviato un link per entrare.");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-5 backdrop-blur-md"
      aria-label="Accesso con link email"
    >
      <label className="text-left">
        <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">
          Email
        </span>
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
      <Pro2Button type="submit" disabled={busy} className="w-full justify-center">
        {busy ? "Invio…" : "Invia link di accesso"}
      </Pro2Button>
      {msg ? (
        <p
          className={`text-center text-xs leading-relaxed ${msg.includes("posta") ? "text-emerald-300/90" : "text-amber-300/90"}`}
          role="status"
        >
          {msg}
        </p>
      ) : null}
    </form>
  );
}
