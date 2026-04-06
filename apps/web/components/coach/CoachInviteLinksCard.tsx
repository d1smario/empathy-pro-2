"use client";

import { useCallback, useState } from "react";
import { Pro2Button } from "@/components/ui/empathy";

/**
 * Crea link invito (coach). Richiede role coach + SUPABASE_SERVICE_ROLE_KEY + tabella coach_invitations.
 */
export function CoachInviteLinksCard() {
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createInvite = useCallback(async () => {
    setErr(null);
    setCopied(false);
    setBusy(true);
    try {
      const res = await fetch("/api/coach/invites", { method: "POST" });
      const j = (await res.json()) as {
        ok?: boolean;
        token?: string;
        expiresAt?: string;
        error?: string;
        ttlDays?: number;
      };
      if (!res.ok || !j.ok || !j.token) {
        setErr(j.error ?? "Impossibile creare l’invito.");
        setInviteUrl(null);
        setExpiresAt(null);
        return;
      }
      const origin = window.location.origin;
      setInviteUrl(`${origin}/invite/${j.token}`);
      setExpiresAt(j.expiresAt ?? null);
    } catch {
      setErr("Errore di rete.");
      setInviteUrl(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const copy = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("Copia negata dal browser.");
    }
  }, [inviteUrl]);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Inviti atleta"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500/80 via-blue-500/80 to-indigo-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-cyan-300">
          Coach · invito atleta
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Genera un link monouso (7 giorni). L’atleta apre il link, fa login come utente <strong>private</strong> con
          profilo atleta già presente, e accetta: viene creata la riga in <code className="text-gray-500">coach_athletes</code>{" "}
          per la tua org (<code className="text-gray-500">EMPATHY_COACH_ATHLETES_ORG_ID</code>).
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Richiede <code className="text-pink-300">SUPABASE_SERVICE_ROLE_KEY</code> solo server e migration{" "}
          <code className="text-gray-500">coach_invitations</code>.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Pro2Button type="button" disabled={busy} onClick={() => void createInvite()}>
            {busy ? "Creazione…" : "Genera nuovo link"}
          </Pro2Button>
          {inviteUrl ? (
            <Pro2Button type="button" variant="secondary" onClick={() => void copy()}>
              {copied ? "Copiato" : "Copia link"}
            </Pro2Button>
          ) : null}
        </div>

        {err ? (
          <p className="mt-4 text-sm text-amber-300/90" role="alert">
            {err}
          </p>
        ) : null}

        {inviteUrl ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 text-left">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-gray-500">Link</p>
            <p className="mt-1 break-all font-mono text-xs text-gray-300">{inviteUrl}</p>
            {expiresAt ? (
              <p className="mt-2 text-xs text-gray-500">Scadenza: {new Date(expiresAt).toLocaleString()}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
