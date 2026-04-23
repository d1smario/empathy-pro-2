"use client";

import { useCallback, useState } from "react";
import { Pro2Button } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";

/**
 * Link di invito per coach abilitato.
 */
export function CoachInviteLinksCard() {
  const { role, coachOperationalApproved, loading: ctxLoading } = useActiveAthlete();
  const inviteDisabled =
    ctxLoading || role !== "coach" || (role === "coach" && !coachOperationalApproved);
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
      setErr("Copia non riuscita.");
    }
  }, [inviteUrl]);

  if (!ctxLoading && role === "private") {
    return null;
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg backdrop-blur-xl sm:p-6"
      aria-label="Invita atleta"
    >
      <div className="relative">
        <h2 className="text-lg font-bold text-white">Invita atleta</h2>
        <p className="mt-1 text-sm text-gray-500">
          {inviteDisabled && role === "coach"
            ? "Disponibile dopo abilitazione amministratore."
            : "Genera un link (7 giorni) e invialo all’atleta."}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Pro2Button type="button" disabled={busy || inviteDisabled} onClick={() => void createInvite()}>
            {busy ? "Creazione…" : "Genera link"}
          </Pro2Button>
          {inviteUrl ? (
            <Pro2Button type="button" variant="secondary" onClick={() => void copy()}>
              {copied ? "Copiato" : "Copia link"}
            </Pro2Button>
          ) : null}
        </div>

        {err ? (
          <p className="mt-3 text-sm text-amber-200/90" role="alert">
            {err}
          </p>
        ) : null}

        {inviteUrl ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 text-left">
            <p className="break-all font-mono text-xs text-gray-300">{inviteUrl}</p>
            {expiresAt ? <p className="mt-2 text-xs text-gray-500">Scade: {new Date(expiresAt).toLocaleString()}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
