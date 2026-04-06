"use client";

import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { ListOrdered, Sparkles, Wrench } from "lucide-react";

/**
 * Virya (URL canonico `/training/vyria`, alias `/training/virya`): annual / macro structure.
 * Regola architetturale: ogni sessione concreta passa dal builder (`POST /api/training/engine/generate`), non da un secondo motore.
 */
export default function TrainingVyriaPlaceholderView() {
  return (
    <Pro2ModulePageShell
      eyebrow="Training · Virya"
      eyebrowClassName="text-violet-400"
      title="Annual plan"
      description={
        <>
          Macro orchestration will land here (phases, weekly load, events). Every block that becomes real training will be
          <strong className="font-semibold text-gray-200"> materialized through the builder </strong>(
          <code className="text-pink-300/90">/api/training/engine/generate</code>
          ) — a single session generator.
        </>
      }
      headerActions={
        <>
          <Pro2Link
            href="/training"
            variant="ghost"
            className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:border-cyan-400/50 hover:bg-cyan-500/15"
          >
            Hub training
          </Pro2Link>
          <Pro2Link
            href="/training/calendar"
            variant="ghost"
            className="justify-center border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15"
          >
            Calendar
          </Pro2Link>
          <Pro2Link
            href="/training/builder"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Open builder
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        <TrainingSubnav />
      </div>

      <Pro2SectionCard
        accent="violet"
        title="Implementation order"
        subtitle="Pipeline toward Calendar"
        icon={ListOrdered}
      >
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-300">
          <li>Builder (deterministic engine) — live at /training/builder</li>
          <li>
            Calendar materialization — <code className="text-violet-200/90">POST /api/training/planned/insert</code> after generation
            (Virya will use the same point for each slot)
          </li>
          <li>Virya: annual grid + builder + repeated inserts (no parallel session engine)</li>
        </ol>
      </Pro2SectionCard>

      <Pro2SectionCard accent="amber" title="Pro 2 status" subtitle="Architecture" icon={Sparkles}>
        <p className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <Wrench className="h-3.5 w-3.5 shrink-0 text-zinc-400 drop-shadow-[0_0_6px_rgba(161,161,170,0.35)]" aria-hidden />
          No parallel session engine; Virya orchestrates, the builder materializes.
        </p>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
