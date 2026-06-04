"use client";

import type { ExecutedWorkout } from "@empathy/domain-training";
import { Activity, Gauge, Map as MapIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { SessionRouteMap } from "@/components/training/SessionRouteMap";
import { SportDisciplineGlyph } from "@/components/training/SportDisciplineGlyph";
import { TrainingSingleTraceChart } from "@/components/training/TrainingSingleTraceChart";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import {
  formatElapsedLabel,
  geoPointsFromWorkoutTrace,
  pickPrimaryExecutedWorkout,
} from "@/lib/training/calendar-analyzer-helpers";
import {
  buildSessionDetailVM,
  type SessionDetailViewModel,
  type SessionKpiTile,
} from "@/lib/training/session-detail-summary";
import {
  type GeoPoint,
  isGeoPoint,
  type SeriesChannelId,
} from "@/lib/training/series-channel-registry";
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

/**
 * Canali scalari renderizzati come trace chart. `route` è gestito a parte come
 * mini-mappa (vedi `SessionRouteMap`); `time_elapsed` non si chartizza da solo.
 */
type ChartChannel = Exclude<SeriesChannelId, "route" | "time_elapsed">;

const CHART_CHANNELS: ReadonlySet<ChartChannel> = new Set([
  "power",
  "hr",
  "speed",
  "cadence",
  "altitude",
  "temperature",
  "distance",
  "pace_min_per_km",
  "vertical_speed_mps",
]);

const SERIES_COLOR: Record<ChartChannel, string> = {
  power: "#f0abfc",
  hr: "#34d399",
  speed: "#22d3ee",
  cadence: "#a78bfa",
  altitude: "#fb923c",
  temperature: "#facc15",
  distance: "#60a5fa",
  pace_min_per_km: "#f472b6",
  vertical_speed_mps: "#fb923c",
};

const SESSION_SERIES_CHART_CHANNELS = Array.from(CHART_CHANNELS).join(",");

const SERIES_LABEL: Record<ChartChannel, string> = {
  power: "Potenza",
  hr: "FC",
  speed: "Velocità",
  cadence: "Cadenza",
  altitude: "Quota",
  temperature: "Temperatura",
  distance: "Distanza",
  pace_min_per_km: "Pace",
  vertical_speed_mps: "Vel. verticale",
};

type ExtendedSeriesBundle = {
  channel: ChartChannel;
  unit: string;
  values: number[];
};

type RouteBundle = { points: GeoPoint[] };

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
  workout,
  dayExecutedDuration,
  athleteId,
}: {
  vm: SessionDetailViewModel;
  workout: ExecutedWorkout;
  dayExecutedDuration: number | null;
  athleteId: string | null | undefined;
}) {
  const traceRoutePoints = useMemo(() => geoPointsFromWorkoutTrace(workout), [workout]);
  const [dbSeries, setDbSeries] = useState<ExtendedSeriesBundle[]>([]);
  const [routeBundle, setRouteBundle] = useState<RouteBundle | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);

  useEffect(() => {
    setRouteBundle(traceRoutePoints.length > 0 ? { points: traceRoutePoints } : null);
  }, [traceRoutePoints]);

  useEffect(() => {
    if (!athleteId || !vm.workoutId) return;
    let cancelled = false;
    const needsRouteFromDb = traceRoutePoints.length < 2;
    const channels = needsRouteFromDb
      ? `${SESSION_SERIES_CHART_CHANNELS},route`
      : SESSION_SERIES_CHART_CHANNELS;
    (async () => {
      try {
        const q = new URLSearchParams({ athleteId, executedId: vm.workoutId, channels });
        const res = await fetch(`/api/training/session-series?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        if (!res.ok) return;
        const json = (await res.json()) as
          | {
              ok: true;
              channels: Array<{
                channel: string;
                unit: string;
                shape?: "scalar" | "geo_point";
                samples: unknown[];
              }>;
            }
          | { ok: false; error?: string };
        if (cancelled || !("ok" in json) || !json.ok) return;

        const merged: ExtendedSeriesBundle[] = [];
        for (const c of json.channels) {
          if (c.channel === "route") {
            const pts = (Array.isArray(c.samples) ? c.samples : []).filter(isGeoPoint) as GeoPoint[];
            if (pts.length >= 1) {
              setRouteBundle((prev) =>
                !prev || pts.length > prev.points.length ? { points: pts } : prev,
              );
            }
            continue;
          }
          if (!CHART_CHANNELS.has(c.channel as ChartChannel)) continue;
          const nums = Array.isArray(c.samples)
            ? (c.samples.filter((v) => typeof v === "number" && Number.isFinite(v)) as number[])
            : [];
          if (nums.length < 1) continue;
          /** Recharts line/area: almeno 2 punti; con 1 campione (sessioni brevi) duplichiamo costante. */
          const chartValues = nums.length >= 2 ? nums : [nums[0]!, nums[0]!];
          if (c.channel === "distance") {
            const last = nums[nums.length - 1];
            if (typeof last === "number" && Number.isFinite(last)) setDistanceMeters(last);
          }
          merged.push({
            channel: c.channel as ChartChannel,
            unit: c.unit,
            values: chartValues,
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
  }, [athleteId, vm.workoutId, traceRoutePoints.length]);

  const allSeries = useMemo<ExtendedSeriesBundle[]>(() => {
    /**
     * Merge: serie in `trace_summary` (vm.series, fonte VM legacy) + serie HD da DB.
     * DB ha priorità per i canali presenti in entrambi (più completo + nuovi canali).
     */
    const byChannel = new Map<ChartChannel, ExtendedSeriesBundle>();
    for (const s of vm.series) {
      if (CHART_CHANNELS.has(s.channel as ChartChannel)) {
        byChannel.set(s.channel as ChartChannel, {
          channel: s.channel as ChartChannel,
          unit: s.unit,
          values: s.values,
        });
      }
    }
    for (const s of dbSeries) byChannel.set(s.channel, s);
    return Array.from(byChannel.values());
  }, [vm.series, dbSeries]);

  const seriesChannels = allSeries.map((s) => s.channel);
  const [activeChannel, setActiveChannel] = useState<ChartChannel | null>(seriesChannels[0] ?? null);

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
        {distanceMeters != null && !vm.kpi.some((t) => t.label === "Distanza") ? (
          <KpiTile
            tile={{
              label: "Distanza",
              value: (distanceMeters / 1000).toFixed(2),
              unit: "km",
              accent: "fuchsia",
            }}
          />
        ) : null}
      </div>

      {routeBundle && routeBundle.points.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MapIcon className="h-3.5 w-3.5 text-fuchsia-300" />
            <p className="font-mono text-[0.6rem] font-bold uppercase tracking-wider text-fuchsia-300">
              Percorso GPS
            </p>
            <span className="font-mono text-[0.6rem] uppercase tracking-wider text-zinc-500">
              {routeBundle.points.length} pt
              {routeBundle.points.length === 2 &&
              routeBundle.points[0]!.lat === routeBundle.points[1]!.lat &&
              routeBundle.points[0]!.lon === routeBundle.points[1]!.lon
                ? vm.parserEngine === "garmin_wellness_api_summary"
                  ? " · solo punto di partenza (Activity Details Garmin non ancora ricevuto)"
                  : " · solo un punto GPS — nessun tracciato interpolato"
                : ""}
            </span>
          </div>
          <SessionRouteMap points={routeBundle.points} />
        </div>
      ) : null}

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
  const sortedExecuted = useMemo(() => {
    const primary = pickPrimaryExecutedWorkout(dayExecuted);
    if (!primary) return dayExecuted;
    return [primary, ...dayExecuted.filter((w) => w.id !== primary.id)];
  }, [dayExecuted]);
  const vms = useMemo(() => sortedExecuted.map((w) => buildSessionDetailVM(w)), [sortedExecuted]);
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
        const w = sortedExecuted[idx]!;
        const duration = Number.isFinite(w.durationMinutes) ? w.durationMinutes : null;
        return (
          <Pro2SectionCard
            key={vm.workoutId}
            accent={idx === 0 ? "cyan" : "violet"}
            title={idx === 0 ? "Sessione del giorno" : `Sessione · ${idx + 1}`}
            subtitle={idx === 0 ? subtitle : `${vm.sport ?? "Sessione"} · ${vm.sourceLabel}`}
            icon={idx === 0 ? Activity : Gauge}
          >
            <SessionDetailCard
              vm={vm}
              workout={w}
              dayExecutedDuration={duration}
              athleteId={athleteId}
            />
          </Pro2SectionCard>
        );
      })}
    </div>
  );
}
