import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Pro2SectionAccent =
  | "fuchsia"
  | "violet"
  | "cyan"
  | "orange"
  | "emerald"
  | "amber"
  | "rose"
  | "slate";

const ACCENT: Record<
  Pro2SectionAccent,
  { section: string; iconWrap: string; iconClass: string }
> = {
  fuchsia: {
    section:
      "border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/[0.12] via-orange-950/[0.08] to-black/85 shadow-inner",
    iconWrap:
      "border-fuchsia-400/45 bg-fuchsia-500/35 text-fuchsia-50 shadow-[0_0_16px_rgba(217,70,239,0.35)]",
    iconClass: "text-fuchsia-50",
  },
  violet: {
    section: "border-violet-500/25 bg-gradient-to-br from-violet-950/[0.14] via-black/60 to-black/85 shadow-inner",
    iconWrap:
      "border-violet-400/45 bg-violet-500/35 text-violet-50 shadow-[0_0_16px_rgba(139,92,246,0.35)]",
    iconClass: "text-violet-50",
  },
  cyan: {
    section:
      "border-cyan-500/25 bg-gradient-to-br from-cyan-950/[0.14] via-black/55 to-violet-950/[0.08] shadow-inner",
    iconWrap: "border-cyan-400/45 bg-cyan-500/35 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.3)]",
    iconClass: "text-cyan-50",
  },
  orange: {
    section: "border-orange-500/25 bg-orange-500/5 shadow-inner",
    iconWrap:
      "border-orange-400/45 bg-orange-500/35 text-orange-50 shadow-[0_0_16px_rgba(251,146,60,0.35)]",
    iconClass: "text-orange-50",
  },
  emerald: {
    section:
      "border-emerald-500/25 bg-gradient-to-br from-emerald-950/[0.12] via-teal-950/[0.08] to-black/85 shadow-inner",
    iconWrap:
      "border-emerald-400/45 bg-emerald-500/35 text-emerald-50 shadow-[0_0_16px_rgba(52,211,153,0.3)]",
    iconClass: "text-emerald-50",
  },
  amber: {
    section: "border-amber-500/25 bg-amber-500/[0.07] shadow-inner",
    iconWrap: "border-amber-400/45 bg-amber-500/35 text-amber-50 shadow-[0_0_16px_rgba(251,191,36,0.3)]",
    iconClass: "text-amber-50",
  },
  rose: {
    section:
      "border-rose-500/25 bg-gradient-to-br from-rose-950/[0.14] via-pink-950/[0.08] to-black/85 shadow-inner",
    iconWrap: "border-rose-400/45 bg-rose-500/35 text-rose-50 shadow-[0_0_16px_rgba(244,63,94,0.28)]",
    iconClass: "text-rose-50",
  },
  slate: {
    section: "border-white/15 bg-gradient-to-br from-zinc-900/50 to-black/80 shadow-inner",
    iconWrap: "border-zinc-500/50 bg-zinc-700/40 text-zinc-100 shadow-inner",
    iconClass: "text-zinc-100",
  },
};

/**
 * Sezione card canone Builder: bordo accent, gradiente/tint, header con icona in riquadro.
 */
export function Pro2SectionCard({
  accent,
  title,
  subtitle,
  icon: Icon,
  children,
  className,
  headerClassName,
  bodyClassName,
}: {
  accent: Pro2SectionAccent;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}) {
  const a = ACCENT[accent];
  return (
    <section className={cn("rounded-2xl border p-6 sm:p-6", a.section, className)}>
      <div className={cn("mb-5 flex flex-wrap items-start gap-3", headerClassName)}>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2",
            a.iconWrap,
          )}
          aria-hidden
        >
          <Icon className={cn("h-5 w-5", a.iconClass)} strokeWidth={2.35} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-gray-400">{subtitle}</p> : null}
        </div>
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
