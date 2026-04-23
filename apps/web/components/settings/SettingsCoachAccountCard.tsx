"use client";

import { useCallback, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";
import { Pro2Button, Pro2Link } from "@/components/ui/empathy";

/**
 * Attivazione ruolo coach e link al modulo roster/inviti (stesso schema Supabase di V1).
 */
export function SettingsCoachAccountCard() {
  const { role, signedIn, refresh, athletes, coachOperationalApproved, platformCoachStatus } = useActiveAthlete();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmCoach, setConfirmCoach] = useState(false);
  const [confirmPrivate, setConfirmPrivate] = useState(false);

  const canRevertToPrivate = role === "coach" && athletes.length === 0;

  const activateCoach = useCallback(async () => {
    setErr(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setErr("Supabase non configurato.");
      return;
    }
    const {
      data: { user },
      error: uErr,
    } = await supabase.auth.getUser();
    if (uErr || !user) {
      setErr("Sessione non disponibile. Riesegui il login.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/access/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          userId: user.id,
          role: "coach",
          athleteId: null,
          email: (user.email ?? "").trim().toLowerCase() || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Attivazione coach non riuscita.");
        return;
      }
      setConfirmCoach(false);
      refresh();
    } catch {
      setErr("Errore di rete.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const revertToPrivate = useCallback(async () => {
    setErr(null);
    const supabase = createEmpathyBrowserSupabase();
    if (!supabase) {
      setErr("Supabase non configurato.");
      return;
    }
    const {
      data: { user },
      error: uErr,
    } = await supabase.auth.getUser();
    if (uErr || !user) {
      setErr("Sessione non disponibile.");
      return;
    }
    setBusy(true);
    try {
      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const firstName = typeof meta?.first_name === "string" ? meta.first_name : null;
      const lastName = typeof meta?.last_name === "string" ? meta.last_name : null;
      const res = await fetch("/api/access/ensure-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          userId: user.id,
          role: "private",
          athleteId: null,
          email: (user.email ?? "").trim().toLowerCase() || null,
          firstName,
          lastName,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(j.error ?? "Ripristino account privato non riuscito.");
        return;
      }
      setConfirmPrivate(false);
      refresh();
    } catch {
      setErr("Errore di rete.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  if (!signedIn) {
    return (
      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
        aria-label="Account coach"
      >
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-300">Coach · account</p>
        <p className="mt-3 text-sm text-gray-400">
          Accedi per attivare la modalità coach o tornare a privato. Se vedi questa scritta a lungo, ricarica la pagina dopo il
          login.
        </p>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
      aria-label="Account coach"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500/80 via-fuchsia-500/80 to-cyan-500/80 opacity-70"
        aria-hidden
      />
      <div className="relative">
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-300">Coach · account</p>
        <h2 className="mt-2 text-xl font-bold text-white">Modalità coach</h2>
        <p className="mt-2 text-sm text-gray-400">
          Ruolo attuale: <strong className="text-gray-200">{role === "coach" ? "coach" : "privato"}</strong>. Il coach non
          tiene un <code className="text-gray-500">athlete_id</code> proprio in <code className="text-gray-500">app_user_profiles</code>
          : lavora sugli atleti collegati in <code className="text-gray-500">coach_athletes</code> (roster + inviti).
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4 text-xs text-gray-500">
          <p className="font-mono text-[0.6rem] uppercase tracking-wider text-gray-600">Requisiti inviti</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Abilitazione coach da console <strong className="text-gray-400">Admin · Piattaforma</strong> (stato approved).</li>
            <li>
              Variabile server <code className="text-pink-300">SUPABASE_SERVICE_ROLE_KEY</code> (solo API invito/accept).
            </li>
            <li>
              Tabella <code className="text-gray-400">coach_invitations</code> e <code className="text-gray-400">EMPATHY_COACH_ATHLETES_ORG_ID</code>{" "}
              allineata all&apos;org in Supabase.
            </li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Pro2Link
            href="/athletes"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Apri modulo Atleti (roster + inviti)
          </Pro2Link>
        </div>

        {role !== "coach" ? (
          <div className="mt-6 space-y-3">
            {!confirmCoach ? (
              <Pro2Button type="button" disabled={busy} onClick={() => setConfirmCoach(true)}>
                Attiva modalità coach
              </Pro2Button>
            ) : (
              <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-sm text-amber-100/90">
                  Confermi? Passerai a <strong>coach</strong>: il profilo non userà più un atleta &quot;personale&quot; in{" "}
                  <code className="text-gray-400">app_user_profiles</code>. Collegherai atleti da{" "}
                  <strong>Coach · Atleti</strong> (inviti o Supabase). L’abilitazione operativa richiede approvazione
                  amministratore (stato <code className="text-gray-400">pending</code> fino ad approvazione).
                </p>
                <div className="flex flex-wrap gap-2">
                  <Pro2Button type="button" disabled={busy} onClick={() => void activateCoach()}>
                    {busy ? "Salvataggio…" : "Conferma attivazione coach"}
                  </Pro2Button>
                  <Pro2Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmCoach(false)}>
                    Annulla
                  </Pro2Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-gray-400">Sei già in modalità coach. Usa il modulo Atleti per roster e link invito.</p>
            {!coachOperationalApproved ? (
              <p className="rounded-xl border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
                Stato piattaforma: <strong className="text-amber-50">{platformCoachStatus ?? "pending"}</strong>. Inviti e
                contesto atleta operativi solo dopo approvazione in console Admin.
              </p>
            ) : null}
            {canRevertToPrivate ? (
              !confirmPrivate ? (
                <Pro2Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmPrivate(true)}>
                  Torna a account privato
                </Pro2Button>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4">
                  <p className="text-sm text-cyan-100/90">
                    Nessun atleta collegato al roster: puoi tornare a <strong>privato</strong>. Verrà creato o riallineato il
                    profilo atleta dalla tua email.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Pro2Button type="button" disabled={busy} onClick={() => void revertToPrivate()}>
                      {busy ? "Salvataggio…" : "Conferma account privato"}
                    </Pro2Button>
                    <Pro2Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmPrivate(false)}>
                      Annulla
                    </Pro2Button>
                  </div>
                </div>
              )
            ) : (
              <p className="text-xs text-gray-500">
                Per tornare privato servono zero collegamenti <code className="text-gray-600">coach_athletes</code>. Rimuovi i
                link dal database o revoca gli accessi, poi riprova.
              </p>
            )}
          </div>
        )}

        {err ? (
          <p className="mt-4 text-sm text-amber-300/90" role="alert">
            {err}
          </p>
        ) : null}
      </div>
    </section>
  );
}
