"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";

/**
 * Dopo `resetPasswordForEmail` → `/auth/callback` (exchange code) → qui.
 * `supabase.auth.updateUser({ password })` richiede la sessione temporanea del recovery.
 */
export function AuthSetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setSessionOk(false);
      setMsg("Supabase non configurato.");
      return;
    }
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionOk(Boolean(session));
      if (!session) {
        setMsg("Sessione non valida o link scaduto. Richiedi un nuovo link da Access → Password dimenticata.");
      }
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setMsg("Supabase non configurato.");
      return;
    }
    if (password.length < 8) {
      setMsg("Password minimo 8 caratteri.");
      return;
    }
    if (password !== password2) {
      setMsg("Le password non coincidono.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    window.location.assign("/dashboard");
  }

  if (sessionOk === false) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-6">
        {msg ? <p className="text-center text-sm text-amber-200/90">{msg}</p> : null}
        <Pro2Link href="/access" variant="primary" className="justify-center">
          Torna ad Access
        </Pro2Link>
      </div>
    );
  }

  if (sessionOk === null) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 px-8 py-6 text-sm text-gray-400">Caricamento…</div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-6 backdrop-blur-md"
      aria-label="Imposta nuova password"
    >
      <label className="text-left">
        <span className="mb-1.5 block font-mono text-[0.6rem] uppercase tracking-[0.2em] text-gray-500">Nuova password</span>
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
        {busy ? "Salvataggio…" : "Salva password e continua"}
      </Pro2Button>
      <button
        type="button"
        disabled={busy}
        onClick={() => router.push("/access")}
        className="text-center text-xs text-gray-500 hover:text-gray-300"
      >
        Annulla
      </button>
      {msg ? (
        <p className="text-center text-xs text-amber-200/90" role="alert">
          {msg}
        </p>
      ) : null}
    </form>
  );
}
