"use client";

import type { PlannedSessionMetrics } from "@/lib/training/physiology/planned-session-metrics";

function formatDurationMin(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(min)}m`;
}

export function PlannedSessionKpiStrip({
  metrics,
  compact = false,
}: {
  metrics: PlannedSessionMetrics;
  compact?: boolean;
}) {
  const gridClass = compact
    ? "grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
    : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

  return (
    <div className={gridClass}>
      <div className="rounded-2xl border border-emerald-500/45 bg-emerald-500/[0.12] px-4 py-3">
        <div className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-200/80">Durata</div>
        <div className="mt-1 text-xl font-bold tabular-nums text-emerald-50">{formatDurationMin(metrics.durationMinutes)}</div>
      </div>
      <div className="rounded-2xl border border-rose-500/45 bg-rose-500/[0.12] px-4 py-3">
        <div className="text-[0.65rem] font-bold uppercase tracking-wider text-rose-200/80">Carico · TSS</div>
        <div className="mt-1 text-xl font-bold tabular-nums text-rose-50">{metrics.tss > 0 ? metrics.tss.toFixed(0) : "—"}</div>
      </div>
      <div className="rounded-2xl border border-sky-500/45 bg-sky-500/[0.12] px-4 py-3">
        <div className="text-[0.65rem] font-bold uppercase tracking-wider text-sky-200/80">kJ · meccanico</div>
        <div className="mt-1 text-xl font-bold tabular-nums text-sky-50">{metrics.kj > 0 ? metrics.kj.toFixed(0) : "—"}</div>
      </div>
      <div className="rounded-2xl border border-amber-500/45 bg-amber-500/[0.12] px-4 py-3">
        <div className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-200/80">Kcal · metabolico</div>
        <div className="mt-1 text-xl font-bold tabular-nums text-amber-50">{metrics.kcal > 0 ? metrics.kcal.toFixed(0) : "—"}</div>
      </div>
      <div className="rounded-2xl border border-violet-500/45 bg-violet-500/[0.12] px-4 py-3">
        <div className="text-[0.65rem] font-bold uppercase tracking-wider text-violet-200/80">Pavg</div>
        <div className="mt-1 text-xl font-bold tabular-nums text-violet-50">
          {metrics.avgPowerW != null && metrics.avgPowerW > 0 ? `${metrics.avgPowerW} W` : "—"}
        </div>
      </div>
    </div>
  );
}
