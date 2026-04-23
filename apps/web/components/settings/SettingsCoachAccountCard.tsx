"use client";

import Link from "next/link";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2Link } from "@/components/ui/empathy";

/**
 * Solo informativa: ruolo coach / privato si imposta in fase di accesso (`/access`), non da Impostazioni.
 * Abilitazione operativa coach da console Admin (`/admin`).
 */
export function SettingsCoachAccountCard() {
  const { role, signedIn, coachOperationalApproved, platformCoachStatus } = useActiveAthlete();

  if (!signedIn) {
    return (
      <section
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl sm:p-8"
        aria-label="Account coach"
      >
        <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-violet-300">Coach · account</p>
        <p className="mt-3 text-sm text-gray-400">
          Accedi per vedere il ruolo del tuo account. Il tipo atleta / coach si sceglie in{" "}
          <Pro2Link href="/access" variant="secondary" className="inline-flex border border-white/15 px-2 py-0.5 text-xs">
            Accesso
          </Pro2Link>{" "}
          (non da qui).
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
        <h2 className="mt-2 text-xl font-bold text-white">Ruolo account</h2>
        <p className="mt-2 text-sm text-gray-400">
          Tipo account attuale: <strong className="text-gray-200">{role === "coach" ? "coach" : "atleta (privato)"}</strong>.
          La scelta tra <strong className="text-gray-300">Atleta</strong> e <strong className="text-gray-300">Coach</strong> va
          fatta alla{" "}
          <Link href="/access" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
            pagina di accesso
          </Link>{" "}
          (login o registrazione): da Impostazioni <strong className="text-gray-300">non</strong> si cambia ruolo, così
          l’amministrazione ha un solo punto di controllo oltre alla console{" "}
          <code className="text-gray-500">/admin</code>.
        </p>

        {role === "coach" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4 text-sm text-gray-400">
            <p>
              Stato piattaforma:{" "}
              <strong className="text-gray-200">{platformCoachStatus ?? "pending"}</strong>
              {coachOperationalApproved ? (
                <span className="text-emerald-300/90"> — operativo (inviti e roster attivi).</span>
              ) : (
                <span className="text-amber-200/90"> — in attesa di approvazione amministratore.</span>
              )}
            </p>
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4 text-xs text-gray-500">
          <p className="font-mono text-[0.6rem] uppercase tracking-wider text-gray-600">Operatività coach</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Roster e inviti: modulo <strong className="text-gray-400">Coach · Atleti</strong> (<code className="text-gray-500">/athletes</code>).</li>
            <li>Abilitazione da <strong className="text-gray-400">Admin · Piattaforma</strong> (stato <code className="text-gray-400">approved</code>).</li>
            <li>
              Server: <code className="text-pink-300">SUPABASE_SERVICE_ROLE_KEY</code>, tabelle{" "}
              <code className="text-gray-400">coach_invitations</code>, org <code className="text-gray-400">EMPATHY_COACH_ATHLETES_ORG_ID</code>.
            </li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Pro2Link
            href="/athletes"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Coach · Atleti
          </Pro2Link>
          <Pro2Link href="/access" variant="ghost" className="justify-center border border-white/15 text-gray-300">
            Pagina accesso (cambio account)
          </Pro2Link>
        </div>
      </div>
    </section>
  );
}
