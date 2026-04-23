"use client";

import Link from "next/link";
import { CoachInviteLinksCard } from "@/components/coach/CoachInviteLinksCard";
import { CoachRosterCard } from "@/components/coach/CoachRosterCard";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Users } from "lucide-react";

/**
 * Modulo **Coach · Atleti**: roster, inviti e messaggio se l’account coach non è ancora approvato.
 */
export function CoachAthletesModulePanel() {
  const { role, coachOperationalApproved, platformCoachStatus, loading, signedIn } = useActiveAthlete();
  const showPrivateNotCoach =
    !loading && signedIn && role === "private";
  const showPendingCoach =
    !loading && role === "coach" && !coachOperationalApproved && (platformCoachStatus === "pending" || platformCoachStatus === null);
  const showSuspendedCoach = !loading && role === "coach" && platformCoachStatus === "suspended";

  return (
    <Pro2SectionCard accent="violet" title="Area coach" subtitle="Roster e inviti" icon={Users}>
      <div className="flex flex-col gap-10">
        {showPrivateNotCoach ? (
          <div
            className="rounded-2xl border border-cyan-500/35 bg-cyan-950/20 px-4 py-4 text-sm leading-relaxed text-cyan-50/95"
            role="status"
          >
            <p className="font-semibold text-cyan-100">Account atleta (privato)</p>
            <p className="mt-2 text-cyan-100/85">
              Qui sotto vedi il <strong>tuo</strong> profilo atleta collegato all’email di login: non significa che nel database
              tu sia registrato come <strong>coach</strong>. La console admin elenca solo utenti con{" "}
              <code className="rounded bg-black/30 px-1 text-xs text-gray-200">role = coach</code> in{" "}
              <code className="rounded bg-black/30 px-1 text-xs text-gray-200">app_user_profiles</code>. Per diventare coach
              esci, vai a{" "}
              <Link href="/access" className="font-semibold text-white underline underline-offset-2 hover:text-cyan-50">
                /access
              </Link>{" "}
              e accedi scegliendo <strong>Coach</strong> (poi l’admin vedrà la richiesta in stato pending se applicabile).
            </p>
          </div>
        ) : null}
        {showSuspendedCoach ? (
          <div
            className="rounded-2xl border border-rose-500/40 bg-rose-950/25 px-4 py-4 text-sm leading-relaxed text-rose-100/95"
            role="status"
          >
            <p className="font-semibold text-rose-50">Account coach sospeso</p>
            <p className="mt-2 text-rose-100/85">
              L’amministrazione ha sospeso l’operatività coach. Contatta il supporto per chiarimenti o riattivazione.
            </p>
          </div>
        ) : null}
        {showPendingCoach ? (
          <div
            className="rounded-2xl border border-amber-500/40 bg-amber-950/25 px-4 py-4 text-sm leading-relaxed text-amber-100/95"
            role="status"
          >
            <p className="font-semibold text-amber-50">In attesa di abilitazione</p>
            <p className="mt-2 text-amber-100/85">
              Il tuo profilo coach è registrato ma non ancora approvato dall’amministrazione Empathy. Dopo
              l’approvazione potrai generare inviti e lavorare sul roster atleti.
            </p>
          </div>
        ) : null}
        <CoachRosterCard />
        <CoachInviteLinksCard />
      </div>
    </Pro2SectionCard>
  );
}
