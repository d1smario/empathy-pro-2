"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BrutalistAppBackdrop } from "@/components/shell/BrutalistAppBackdrop";
import { Pro2Button } from "@/components/ui/empathy";

export type InviteInitialStatus = "valid" | "expired" | "consumed" | "not_found" | "misconfigured";

export function InviteTokenClient({
  token,
  initialStatus,
}: {
  token: string;
  initialStatus: InviteInitialStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<InviteInitialStatus>(initialStatus);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const accessHref = `/access?next=${encodeURIComponent(`/invite/${token}`)}`;

  useEffect(() => {
    let c = false;
    (async () => {
      const res = await fetch("/api/auth/session", { cache: "no-store" });
      const j = (await res.json()) as { ok?: boolean; signedIn?: boolean };
      if (!c) setSignedIn(j?.ok === true && Boolean(j.signedIn));
    })();
    return () => {
      c = true;
    };
  }, []);

  const accept = useCallback(async () => {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setMsg(j.error ?? "Richiesta non riuscita.");
        setBusy(false);
        return;
      }
      setMsg("Collegamento creato. Puoi aprire il modulo Athletes dal coach.");
      router.refresh();
    } catch {
      setMsg("Errore di rete.");
    } finally {
      setBusy(false);
    }
  }, [router, token]);

  return (
    <BrutalistAppBackdrop matrix>
      <main
        id="main-content"
        className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center"
      >
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gray-500">Invito coach</p>
        <h1 className="max-w-md bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-2xl font-light tracking-tight text-transparent sm:text-3xl">
          Collega il tuo profilo atleta al coach
        </h1>

        {status === "misconfigured" ? (
          <p className="max-w-md text-sm text-amber-300/90">
            Inviti non disponibili: manca la service role sul server o la tabella non è stata creata.
          </p>
        ) : null}
        {status === "not_found" ? (
          <p className="max-w-md text-sm text-amber-300/90">Questo link non è valido.</p>
        ) : null}
        {status === "consumed" ? (
          <p className="max-w-md text-sm text-gray-400">Questo invito è già stato usato.</p>
        ) : null}
        {status === "expired" ? (
          <p className="max-w-md text-sm text-amber-300/90">Invito scaduto. Chiedi un nuovo link al coach.</p>
        ) : null}

        {status === "valid" ? (
          <div className="flex max-w-md flex-col items-center gap-4">
            {signedIn === false ? (
              <>
                <p className="text-sm text-gray-400">Accedi con lo stesso account che userai come atleta.</p>
                <Link
                  href={accessHref}
                  className="rounded-full border border-purple-500/40 bg-purple-500/15 px-6 py-2.5 text-sm font-bold text-purple-100 transition hover:border-purple-400/60"
                >
                  Vai ad Access / login
                </Link>
              </>
            ) : null}
            {signedIn === true ? (
              <>
                <p className="text-sm text-gray-400">
                  Confermi il collegamento al coach che ti ha inviato il link? Serve un profilo atleta già
                  associato al tuo account (private).
                </p>
                <Pro2Button type="button" disabled={busy} onClick={() => void accept()} className="min-w-[12rem]">
                  {busy ? "Elaborazione…" : "Accetta invito"}
                </Pro2Button>
              </>
            ) : null}
            {signedIn === null ? (
              <p className="text-sm text-gray-500">Verifica sessione…</p>
            ) : null}
          </div>
        ) : null}

        {msg ? (
          <p className={`max-w-md text-sm ${msg.includes("Collegamento") ? "text-emerald-300/90" : "text-amber-300/90"}`} role="status">
            {msg}
          </p>
        ) : null}

        <Link href="/dashboard" className="text-xs text-gray-500 underline-offset-4 hover:text-gray-400 hover:underline">
          Torna alla dashboard
        </Link>
      </main>
    </BrutalistAppBackdrop>
  );
}
