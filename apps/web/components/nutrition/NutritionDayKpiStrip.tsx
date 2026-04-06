"use client";

import type { LucideIcon } from "lucide-react";
import { Drumstick, Droplets, Flame, Wheat } from "lucide-react";

const ACCENT: Record<
  "cyan" | "orange" | "violet" | "emerald",
  {
    border: string;
    bg: string;
    ring: string;
    bar: string;
    value: string;
    iconWrap: string;
    icon: string;
    glow: string;
  }
> = {
  cyan: {
    border: "border-cyan-500/45",
    bg: "bg-gradient-to-br from-cyan-950/55 via-slate-950/40 to-black/50",
    ring: "ring-1 ring-cyan-400/25",
    bar: "from-cyan-400 via-teal-400 to-cyan-600",
    value: "text-cyan-50",
    iconWrap:
      "bg-cyan-500/40 text-cyan-50 border-2 border-cyan-300/60 shadow-[0_0_16px_rgba(34,211,238,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]",
    icon: "drop-shadow-[0_0_6px_rgba(255,255,255,0.5)]",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.12)]",
  },
  orange: {
    border: "border-orange-500/45",
    bg: "bg-gradient-to-br from-orange-950/50 via-zinc-950/40 to-black/50",
    ring: "ring-1 ring-orange-400/25",
    bar: "from-orange-400 via-amber-400 to-orange-600",
    value: "text-orange-50",
    iconWrap:
      "bg-orange-500/40 text-orange-50 border-2 border-orange-300/60 shadow-[0_0_16px_rgba(251,146,60,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]",
    icon: "drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]",
    glow: "shadow-[0_0_24px_rgba(251,146,60,0.12)]",
  },
  violet: {
    border: "border-violet-500/45",
    bg: "bg-gradient-to-br from-violet-950/50 via-zinc-950/40 to-black/50",
    ring: "ring-1 ring-violet-400/25",
    bar: "from-violet-400 via-fuchsia-400 to-violet-600",
    value: "text-violet-50",
    iconWrap:
      "bg-violet-500/40 text-violet-50 border-2 border-violet-300/60 shadow-[0_0_16px_rgba(167,139,250,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]",
    icon: "drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]",
    glow: "shadow-[0_0_24px_rgba(167,139,250,0.12)]",
  },
  emerald: {
    border: "border-emerald-500/45",
    bg: "bg-gradient-to-br from-emerald-950/50 via-zinc-950/40 to-black/50",
    ring: "ring-1 ring-emerald-400/25",
    bar: "from-emerald-400 via-teal-400 to-emerald-600",
    value: "text-emerald-50",
    iconWrap:
      "bg-emerald-500/40 text-emerald-50 border-2 border-emerald-300/60 shadow-[0_0_16px_rgba(52,211,153,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]",
    icon: "drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]",
    glow: "shadow-[0_0_24px_rgba(52,211,153,0.12)]",
  },
};

function KpiCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: keyof typeof ACCENT;
  icon: LucideIcon;
}) {
  const a = ACCENT[accent];
  return (
    <div
      className={`relative min-w-0 flex-1 overflow-hidden rounded-2xl border p-4 backdrop-blur-sm ${a.border} ${a.bg} ${a.ring} ${a.glow}`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-95 ${a.bar}`}
        aria-hidden
      />
      <div className="relative pt-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">{label}</p>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.iconWrap}`}
            aria-hidden
          >
            <Icon className={`h-5 w-5 ${a.icon}`} strokeWidth={2.35} />
          </div>
        </div>
        <p className={`mt-2 font-mono text-2xl font-bold tracking-tight drop-shadow-sm ${a.value}`}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

export type NutritionDayKpiTargets = {
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
};

type NutritionDayKpiStripProps = {
  targets: NutritionDayKpiTargets;
  dateLabel?: string;
};

/**
 * KPI giornalieri principali (stesso linguaggio visivo dei KpiCard del Builder training).
 */
export function NutritionDayKpiStrip({ targets, dateLabel }: NutritionDayKpiStripProps) {
  const kcal = Math.round(targets.kcal);
  const c = Math.round(targets.carbsG);
  const p = Math.round(targets.proteinG);
  const f = Math.round(targets.fatG);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Energia giorno"
        value={`${kcal} kcal`}
        hint={dateLabel ? `Target · ${dateLabel}` : "Budget energetico giornaliero"}
        accent="orange"
        icon={Flame}
      />
      <KpiCard
        label="Carboidrati"
        value={`${c} g`}
        hint="CHO totale"
        accent="cyan"
        icon={Wheat}
      />
      <KpiCard
        label="Proteine"
        value={`${p} g`}
        hint="PRO totale"
        accent="violet"
        icon={Drumstick}
      />
      <KpiCard
        label="Grassi"
        value={`${f} g`}
        hint="Lipidi totali"
        accent="emerald"
        icon={Droplets}
      />
    </div>
  );
}
