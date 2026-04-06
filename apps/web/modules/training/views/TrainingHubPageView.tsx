"use client";

import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { BarChart3, CalendarDays, CalendarRange, Sparkles } from "lucide-react";

/** Hub training: shell e sezioni canone Pro 2 (allineato a Builder). */
export default function TrainingHubPageView() {
  return (
    <Pro2ModulePageShell
      eyebrow="Training · Hub"
      eyebrowClassName="text-orange-400"
      title="Allenamento"
      description="Hub moduli: Builder, Calendar, Analyzer e Virya condividono la stessa linea dati e un solo motore di sessione."
      headerActions={
        <>
          <Pro2Link
            href="/dashboard"
            variant="secondary"
            className="justify-center border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15"
          >
            Dashboard
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        <TrainingSubnav />
      </div>

      <Pro2SectionCard
        accent="fuchsia"
        title="Percorsi"
        subtitle="Quattro viste prodotto + Virya (piano annuale)"
        icon={Sparkles}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Pro2Link
            href="/training/builder"
            variant="secondary"
            className="justify-center border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-600/25 to-violet-600/20 py-4 hover:from-fuchsia-600/35 hover:to-violet-600/30"
          >
            <Sparkles className="mr-2 h-4 w-4 shrink-0 text-fuchsia-300 drop-shadow-[0_0_8px_rgba(232,121,249,0.45)]" aria-hidden />
            Builder sessione
          </Pro2Link>
          <Pro2Link
            href="/training/calendar"
            variant="secondary"
            className="justify-center border border-sky-500/40 bg-sky-500/10 py-4 hover:bg-sky-500/15"
          >
            <CalendarDays className="mr-2 h-4 w-4 shrink-0 text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.45)]" aria-hidden />
            Calendar
          </Pro2Link>
          <Pro2Link
            href="/training/analytics"
            variant="secondary"
            className="justify-center border border-rose-500/40 bg-rose-500/10 py-4 hover:bg-rose-500/15"
          >
            <BarChart3 className="mr-2 h-4 w-4 shrink-0 text-rose-300 drop-shadow-[0_0_8px_rgba(251,113,133,0.4)]" aria-hidden />
            Analyzer
          </Pro2Link>
          <Pro2Link
            href="/training/vyria"
            variant="secondary"
            className="justify-center border border-amber-500/40 bg-amber-500/10 py-4 hover:bg-amber-500/15"
          >
            <CalendarRange className="mr-2 h-4 w-4 shrink-0 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]" aria-hidden />
            Virya · annual
          </Pro2Link>
        </div>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
