"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Pro2Link } from "@/components/ui/empathy";

type SessionPayload =
  | {
      ok: true;
      configured: boolean;
      signedIn: boolean;
      userId: string | null;
      authError?: boolean;
    }
  | { ok?: false };

function BoolPill({ value }: { value: boolean }) {
  return (
    <span
      className={
        value
          ? "rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-200"
          : "rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-gray-500"
      }
    >
      {value ? "Sì" : "No"}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function maskUserId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 12) return "•••";
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

/**
 * Probe `GET /api/auth/session` — niente PII oltre a un id mascherato opzionale.
 */
export function SettingsAuthSessionDiagnostics() {
  const [data, setData] = useState<SessionPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const json = (await res.json()) as SessionPayload;
        if (cancelled) return;
        if (!res.ok || !("ok" in json) || json.ok !== true) {
          setErr("Impossibile leggere lo stato sessione.");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setErr("Richiesta non riuscita.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Diagnostica auth Supabase"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-500/80 via-teal-500/80 to-emerald-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-teal-300">
          Auth · sessione (Supabase SSR)
        </p>
        <p className="mt-2 text-sm text-gray-400">
          Endpoint:{" "}
          <code className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 font-mono text-xs text-pink-300">
            /api/auth/session
          </code>
          . Middleware aggiorna i cookie se{" "}
          <code className="text-gray-500">NEXT_PUBLIC_SUPABASE_*</code> è configurato.
        </p>

        {err ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {err}
          </p>
        ) : null}

        {!err && !data ? (
          <div className="mt-6 space-y-2">
            <div className="h-2 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="h-2 w-56 animate-pulse rounded-full bg-white/10" />
          </div>
        ) : null}

        {data && data.ok ? (
          <div className="mt-6 font-mono text-xs">
            <Row label="Progetto Supabase configurato (env pubblico)">
              <BoolPill value={data.configured} />
            </Row>
            <Row label="Sessione valida (cookie)">
              <BoolPill value={data.signedIn} />
            </Row>
            {"authError" in data && data.authError ? (
              <p className="mt-3 text-amber-400">
                Token/cookie non validi o scaduti (prova logout dal client o ricarica dopo login).
              </p>
            ) : null}
            {data.signedIn && data.userId ? (
              <p className="mt-3 text-gray-500">
                User id (mascherato):{" "}
                <span className="text-gray-400">{maskUserId(data.userId)}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 border-t border-white/10 pt-6">
          <Pro2Link href="/access" variant="secondary" className="justify-center">
            Pagina Access
          </Pro2Link>
        </div>
      </div>
    </section>
  );
}
