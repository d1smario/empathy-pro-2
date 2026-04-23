"use client";

import type { ReactNode } from "react";
import { CoachInviteLinksCard } from "@/components/coach/CoachInviteLinksCard";
import { CoachRosterCard } from "@/components/coach/CoachRosterCard";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Users } from "lucide-react";

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>
  );
}

/**
 * Modulo **Coach · Atleti**: stato account, roster, inviti (copy essenziale, senza dettagli tecnici).
 */
export function CoachAthletesModulePanel() {
  const { role, coachOperationalApproved, platformCoachStatus, loading, signedIn } = useActiveAthlete();

  const showStatus = !loading && signedIn;

  return (
    <Pro2SectionCard accent="violet" title="Coach · Atleti" subtitle="Stato, roster e inviti" icon={Users}>
      <div className="flex flex-col gap-8">
        {showStatus ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 pb-6">
            {role === "private" ? (
              <>
                <Pill className="bg-white/10 text-gray-200">Account atleta</Pill>
                <Pro2Link
                  href="/access"
                  variant="secondary"
                  className="justify-center border border-cyan-500/40 bg-cyan-500/15 text-sm hover:bg-cyan-500/25"
                >
                  Diventa coach
                </Pro2Link>
              </>
            ) : null}
            {role === "coach" && coachOperationalApproved ? (
              <Pill className="bg-emerald-500/20 text-emerald-100">Coach · attivo</Pill>
            ) : null}
            {role === "coach" && !coachOperationalApproved && (platformCoachStatus === "pending" || platformCoachStatus === null) ? (
              <>
                <Pill className="bg-amber-500/20 text-amber-100">Coach · in attesa</Pill>
                <span className="text-sm text-gray-400">L’abilitazione arriva dall’amministratore.</span>
              </>
            ) : null}
            {role === "coach" && platformCoachStatus === "suspended" ? (
              <Pill className="bg-rose-500/20 text-rose-100">Coach · sospeso</Pill>
            ) : null}
          </div>
        ) : null}

        <CoachRosterCard />
        <CoachInviteLinksCard />

        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-6">
          <Pro2Link href="/dashboard" variant="secondary" className="justify-center border border-white/15 text-sm">
            Dashboard
          </Pro2Link>
          <Pro2Link href="/training" variant="secondary" className="justify-center border border-white/15 text-sm">
            Training
          </Pro2Link>
        </div>
      </div>
    </Pro2SectionCard>
  );
}
