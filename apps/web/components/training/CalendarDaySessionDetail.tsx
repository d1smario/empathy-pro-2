"use client";

import type { ExecutedWorkout } from "@empathy/domain-training";
import { Activity, Gauge } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { TrainingSingleTraceChart } from "@/components/training/TrainingSingleTraceChart";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { formatElapsedLabel } from "@/lib/training/calendar-analyzer-helpers";
import {
  buildSessionDetailVM,
  type SeriesChannel,
  type SessionDetailViewModel,
  type SessionKpiTile,
  type SessionSeriesBundle,
} from "@/lib/training/session-detail-summary";
import { cn } from "@/lib/cn";

const ACCENT_TEXT: Record<NonNullable<SessionKpiTile["accent"]>, string> = {
  fuchsia: "text-fuchsia-300",
  violet: "text-violet-300",
  orange: "text-orange-300",
  cyan: "text-cyan-300",
  emerald: "text-emerald-300",
  sky: "text-sky-300",
};

const ACCENT_BORDER: Record<NonNullable<SessionKpiTile["accent"]>, string> = {
  fuchsia: "border-fuchsia-500/25",
  violet: "border-violet-500/25",
  orange: "border-orange-500/25",
  cyan: "border-cyan-500/25",
  emerald: "border-emerald-500/25",
  sky: "border-sky-500/25",
};

const SERIES_COLOR: Record<SeriesChannel, string> = {
  power: "#f0abfc",
  hr: "#34d399",
  speed: "#22d3ee",
  cadence: "#a78bfa",
  altitude: "#fb923c",
  temperature: "#facc15",
};

const SERIES_LABEL: Record<SeriesChannel, string> = {
  power: "Potenza",
  hr: "FC",
  speed: "Velocità",
  cadence: "Cadenza",
  altitude: "Quota",
  temperature: "Temperatura",
};

function fmt(value: number | null, digits: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function KpiTile({ tile }: { tile: SessionKpiTile }) {
  const accent = tile.accent ?? "cyan";
  return (
    <div
      className={cn(
        "rounded-2xl border bg-black/40 px-4 py-3",
        ACCENT_BORDER[accent],
      )}
    >
      <p className={cn("font-mono text-[0.6rem] font-bold uppercase tracking-wider", ACCENT_TEXT[accent])}>
        {tile.label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white">
        {tile.value}
        {tile.unit ? <span className="ml-1 text-sm font-medium text-zinc-400">{tile.unit}</span> : null}
      </p>
    </div>
  );
}

function SessionDetailCard({
  vm,
  dayExecutedDuration,
  athleteId,
}: {
  vm: SessionDetailViewModel;
  dayExecutedDuration: number | null;
  athleteId: string | null | undefined;
}) {
  const [dbSeries, setDbSeries] = useState<SessionSeriesBundle[]>([]);

  useEffect(() => {
    if (!athleteId || !vm.workoutId) return;
    if (vm.series.length > 0) return; // serie già presenti in trace_summary
    let cancelled = false;
    (async () => {
      try {
        const q = new URLSearchParams({ athleteId, executedId: vm.workoutId });
        const res = await fetch(`/api/training/session-series?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        if (!res.ok) return;
        const json = (await res.json()) as
          | {
              ok: true;
              channels: Array<{ channel: string; unit: string; samples: number[] }>;
            }
          | { ok: false; error?: string };
        if (cancelled || !("ok" in json) || !json.ok) return;
        const allowed: ReadonlySet<SeriesChannel> = new Set([
          "power",
          "hr",
          "speed",
          "cadence",
          "altitude",
          "temperature",
        ]);
        const merged: SessionSeriesBundle[] = [];
        for (const c of json.channels) {
          if (!allowed.has(c.channel as SeriesChannel)) continue;
          if (!Array.isArray(c.samples) || c.samples.length < 2) continue;
          merged.push({
            channel: c.channel as SeriesChannel,
            unit: c.unit,
            values: c.samples,
          });
        }
        if (merged.length) setDbSeries(merged);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, vm.workoutId, vm.series.length]);

  const allSeries = useMemo<SessionSeriesBundle[]>(() => {
    if (vm.series.length > 0) return vm.series;
    return dbSeries;
  }, [vm.series, dbSeries]);

  const seriesChannels = allSeries.map((s) => s.channel);
  const [activeChannel, setActiveChannel] = useState<SeriesChannel | null>(seriesChannels[0] ?? null);

  useEffect(() => {
    if (activeChannel && seriesChannels.includes(activeChannel)) return;
    setActiveChannel(seriesChannels[0] ?? null);
  }, [activeChannel, seriesChannels]);

  const activeSeries = useMemo(
    () => (activeChannel ? allSeries.find((s) => s.channel === activeChannel) ?? null : null),
    [activeChannel, allSeries],
  );

  const seriesLabels = useMemo(() => {
    if (!activeSeries) return [] as string[];
    const total = activeSeries.values.length;
    return activeSeries.values.map((_, i) => formatElapsedLabel(i, total, dayExecutedDuration));
  }, [activeSeries, dayExecutedDuration]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {vm.sportGlyph ? <SportDisciplineGlyph glyph={vm.sportGlyph} className="h-9 w-9" /> : null}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.65rem] font-bold uppercase tracking-wider text-zinc-400">
            {vm.sport ?? "Sessione"} · {vm.sourceLabel}
          </p>
          {vm.fileName ? (
            <p className="truncate text-xs text-zinc-500" title={vm.fileName}>
              file: {vm.fileName}
            </p>
          ) : null}
        </div>
        {vm.importQualityNote ? (
          <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-amber-200">
            {vm.importQualityNote}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {vm.kpi.map((tile) => (
          <KpiTile key={tile.label} tile={tile} />
        ))}
      </div>

      {vm.secondary.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
          <table className="w-full divide-y divide-white/5 text-sm">
            <thead>
              <tr className="bg-white/[0.03] text-[0.6rem] font-bold uppercase tracking-wider text-zinc-400">
                <th className="px-3 py-2 text-left">Canale</th>
                <th className="px-3 py-2 text-right">min</th>
                <th className="px-3 py-2 text-right">avg</th>
                <th className="px-3 py-2 text-right">max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono tabular-nums text-zinc-200">
              {vm.secondary.map((row) => (
                <tr key={row.channel}>
                  <td className="px-3 py-2 font-sans text-zinc-300">
                    {row.label}
                    <span className="ml-1 text-[0.65rem] uppercase tracking-wider text-zinc-500">{row.unit}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(row.min, row.unit === "rpm" || row.unit === "m" || row.unit === "W" || row.unit === "bpm" ? 0 : 1)}</td>
                  <td className="px-3 py-2 text-right">{fmt(row.avg, row.unit === "rpm" || row.unit === "m" || row.unit === "W" || row.unit === "bpm" ? 0 : 1)}</td>
                  <td className="px-3 py-2 text-right">{fmt(row.max, row.unit === "rpm" || row.unit === "m" || row.unit === "W" || row.unit === "bpm" ? 0 : 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {allSeries.length > 0 && activeChannel ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {allSeries.map((s) => {
              const isActive = activeChannel === s.channel;
              return (
                <button
                  key={s.channel}
                  type="button"
                  onClick={() => setActiveChannel(s.channel)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition",
                    isActive
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/10 bg-black/40 text-zinc-400 hover:border-white/25 hover:text-zinc-200",
                  )}
                  style={isActive ? { borderColor: SERIES_COLOR[s.channel], color: SERIES_COLOR[s.channel] } : undefined}
                >
                  {SERIES_LABEL[s.channel]}
                </button>
              );
            })}
          </div>
          {activeSeries ? (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
              <TrainingSingleTraceChart
                label={SERIES_LABEL[activeSeries.channel]}
                color={SERIES_COLOR[activeSeries.channel]}
                values={activeSeries.values}
                labels={seriesLabels}
                unit={activeSeries.unit}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-500">
          Nessuna serie temporale ad alta risoluzione disponibile per questa sessione (il summary device non le espone; per curve dense importa il file FIT/TCX/GPX).
        </p>
      )}
    </div>
  );
}

export type CalendarDaySessionDetailProps = {
  selectedDate: string;
  dayExecuted: ExecutedWorkout[];
  athleteId?: string | null;
};

export function CalendarDaySessionDetail({ selectedDate, dayExecuted, athleteId }: CalendarDaySessionDetailProps) {
  const vms = useMemo(() => dayExecuted.map((w) => buildSessionDetailVM(w)), [dayExecuted]);
  const subtitle = `${dayExecuted.length} eseguito${dayExecuted.length === 1 ? "" : "i"} · ${selectedDate}`;

  if (dayExecuted.length === 0) {
    return (
      <div id="day-session-detail" className="scroll-mt-24">
        <Pro2SectionCard
          accent="cyan"
          title="Sessione del giorno"
          subtitle={subtitle}
          icon={Activity}
        >
          <p className="text-sm text-zinc-400">
            Nessuna sessione eseguita registrata per questo giorno. Importa un file (FIT/TCX/GPX) o attendi il sync da
            Garmin/Strava/Wahoo.
          </p>
        </Pro2SectionCard>
      </div>
    );
  }

  return (
    <div id="day-session-detail" className="scroll-mt-24 space-y-6">
      {vms.map((vm, idx) => {
        const w = dayExecuted[idx];
        const duration = Number.isFinite(w.durationMinutes) ? w.durationMinutes : null;
        return (
          <Pro2SectionCard
            key={vm.workoutId}
            accent={idx === 0 ? "cyan" : "violet"}
            title={idx === 0 ? "Sessione del giorno" : `Sessione · ${idx + 1}`}
            subtitle={idx === 0 ? subtitle : `${vm.sport ?? "Sessione"} · ${vm.sourceLabel}`}
            icon={idx === 0 ? Activity : Gauge}
          >
            <SessionDetailCard vm={vm} dayExecutedDuration={duration} athleteId={athleteId} />
          </Pro2SectionCard>
        );
      })}
    </div>
  );
}
