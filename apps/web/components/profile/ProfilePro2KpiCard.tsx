"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, Flame, Heart, Percent, Ruler, Scale, Zap } from "lucide-react";
import { cn } from "@/lib/cn";

/** Allineato a `TrainingBuilderRichPageView` / `NutritionDayKpiStrip` (`docs/PRO2_UI_PAGE_CANON.md` §4). */
export type ProfileKpiAccent = "cyan" | "orange" | "violet" | "emerald" | "slate";

const ACCENT_KPI: Record<
  ProfileKpiAccent,
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
  slate: {
    border: "border-white/20",
    bg: "bg-gradient-to-br from-zinc-900/60 to-black/50",
    ring: "ring-1 ring-white/10",
    bar: "from-zinc-500 via-zinc-400 to-zinc-600",
    value: "text-gray-100",
    iconWrap: "bg-zinc-600/50 text-zinc-100 border-2 border-zinc-400/40 shadow-inner",
    icon: "",
    glow: "",
  },
};

export function profileMetricLabelToAccent(label: string): ProfileKpiAccent {
  const normalized = label.toLowerCase();
  if (normalized.includes("vo2") || normalized.includes("ftp") || normalized.includes("lt")) return "cyan";
  if (normalized.includes("vlamax") || normalized.includes("indice glic") || normalized.includes("glicolitico") || normalized.includes("body fat"))
    return "orange";
  if (normalized.includes("fc") || normalized.includes("hr") || normalized.includes("heart")) return "violet";
  if (normalized.includes("peso") || normalized.includes("altezza")) return "slate";
  return "cyan";
}

export function profileSectionTitleToAccent(title: string): ProfileKpiAccent {
  const normalized = title.toLowerCase();
  if (normalized.includes("metabolic")) return "cyan";
  if (normalized.includes("lactate")) return "orange";
  if (normalized.includes("performance")) return "cyan";
  if (normalized.includes("bioenergetics")) return "emerald";
  if (normalized.includes("recovery")) return "violet";
  return "slate";
}

export function profileMetricIcon(label: string): LucideIcon {
  const n = label.toLowerCase();
  if (n.includes("peso") || n.includes("weight")) return Scale;
  if (n.includes("altezza") || n.includes("height")) return Ruler;
  if (n.includes("ftp") || n.includes("lt") || n.includes("vo2")) return Zap;
  if (n.includes("vla") || n.includes("indice glic") || n.includes("glicolitico")) return Flame;
  if (n.includes("body fat") || n.includes("bf")) return Percent;
  if (n.includes("fc") || n.includes("bpm")) return Heart;
  return Activity;
}

export function ProfilePro2KpiCard({
  label,
  value,
  hint,
  accent,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  accent: ProfileKpiAccent;
  icon: LucideIcon;
  className?: string;
}) {
  const a = ACCENT_KPI[accent];
  return (
    <div
      className={cn(
        "relative min-w-0 overflow-hidden rounded-2xl border p-4 backdrop-blur-sm",
        a.border,
        a.bg,
        a.ring,
        a.glow,
        className,
      )}
    >
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-95", a.bar)} aria-hidden />
      <div className="relative pt-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">{label}</p>
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", a.iconWrap)} aria-hidden>
            <Icon className={cn("h-5 w-5", a.icon)} strokeWidth={2.35} />
          </div>
        </div>
        <p className={cn("mt-2 font-mono text-2xl font-bold tracking-tight drop-shadow-sm", a.value)}>{value}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

export function ProfilePro2KpiGrid({
  items,
  columnsClassName = "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
}: {
  items: { label: string; value: string; accent: ProfileKpiAccent; icon?: LucideIcon; hint?: string }[];
  columnsClassName?: string;
}) {
  return (
    <div className={columnsClassName}>
      {items.map((item) => (
        <ProfilePro2KpiCard
          key={item.label}
          label={item.label}
          value={item.value}
          hint={item.hint}
          accent={item.accent}
          icon={item.icon ?? profileMetricIcon(item.label)}
        />
      ))}
    </div>
  );
}
