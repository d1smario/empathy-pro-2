"use client";

import { CoachInviteLinksCard } from "@/components/coach/CoachInviteLinksCard";
import { CoachRosterCard } from "@/components/coach/CoachRosterCard";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Users } from "lucide-react";

/**
 * Modulo **Coach · Atleti**: roster, inviti e messaggio se l’account coach non è ancora approvato.
 */
export function CoachAthletesModulePanel() {
  const { role, coachOperationalApproved, platformCoachStatus, loading } = useActiveAthlete();
  const showPendingCoach =
    !loading && role === "coach" && !coachOperationalApproved && (platformCoachStatus === "pending" || platformCoachStatus === null);
  const showSuspendedCoach = !loading && role === "coach" && platformCoachStatus === "suspended";

  return (
    <Pro2SectionCard accent="violet" title="Area coach" subtitle="Roster e inviti" icon={Users}>
      <div className="flex flex-col gap-10">
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
