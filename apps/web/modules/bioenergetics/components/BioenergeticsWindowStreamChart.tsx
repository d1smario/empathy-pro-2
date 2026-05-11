"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  WindowStreamChartRow,
  WindowStreamDailyRollupRow,
  WindowStreamStatsV1,
  WindowStreamVariabilityV1,
} from "@/lib/bioenergetics/window-stream-stats";

const GLU_COLOR = "#e879f9";
const LAC_COLOR = "#fb923c";

function formatTickMs(ms: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

function formatStat(n: number | null, digits: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function formatChannelCell(ch: WindowStreamDailyRollupRow["glucose"]): string {
  if (ch.count === 0) return "—";
  return `${ch.count} · ${formatStat(ch.min, 1)}–${formatStat(ch.max, 1)} · μ ${formatStat(ch.mean, 2)}`;
}

type Props = {
  rows: WindowStreamChartRow[];
  stats: WindowStreamStatsV1;
  variability: WindowStreamVariabilityV1;
  dailyRollups: WindowStreamDailyRollupRow[];
  truncated: boolean;
  skippedSchema?: boolean;
};

export function BioenergeticsWindowStreamChart({
  rows,
  stats,
  variability,
  dailyRollups,
  truncated,
  skippedSchema,
}: Props) {
  const hasGlu = stats.glucose.count > 0;
  const hasLac = stats.lactate.count > 0;
  const hasChart = rows.length > 0 && (hasGlu || hasLac);

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-fuchsia-500/25 bg-black/35 px-3 py-2">
          <p className="font-mono text-[0.55rem] uppercase tracking-wider text-fuchsia-300">Glucosio (mmol/L)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">{stats.glucose.count}</p>
          <p className="mt-0.5 text-[0.65rem] text-gray-400">
            min {formatStat(stats.glucose.min, 2)} · max {formatStat(stats.glucose.max, 2)} · μ {formatStat(stats.glucose.mean, 2)}
          </p>
        </div>
        <div className="rounded-xl border border-orange-500/25 bg-black/35 px-3 py-2">
          <p className="font-mono text-[0.55rem] uppercase tracking-wider text-orange-300">Lattato (mmol/L)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">{stats.lactate.count}</p>
          <p className="mt-0.5 text-[0.65rem] text-gray-400">
            min {formatStat(stats.lactate.min, 2)} · max {formatStat(stats.lactate.max, 2)} · μ {formatStat(stats.lactate.mean, 2)}
          </p>
        </div>
        <div className="rounded-xl border border-violet-500/25 bg-black/35 px-3 py-2 sm:col-span-2 lg:col-span-2">
          <p className="font-mono text-[0.55rem] uppercase tracking-wider text-violet-300">Campioni totali (finestra)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">{stats.totalSamples}</p>
          <p className="mt-0.5 text-[0.65rem] text-gray-400">
            Serie canonica 055 · valori misurati nel range selezionato
            {truncated ? <span className="text-amber-200"> · troncatura limite righe</span> : null}
          </p>
        </div>
      </div>

      {!skippedSchema && (stats.totalSamples > 0 || dailyRollups.length > 0) ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-fuchsia-500/20 bg-black/30 px-3 py-2">
            <p className="font-mono text-[0.55rem] uppercase tracking-wider text-fuchsia-200/90">Ampiezza media (glu)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
              {variability.glucoseMeanDailyRange != null && Number.isFinite(variability.glucoseMeanDailyRange)
                ? `${formatStat(variability.glucoseMeanDailyRange, 2)} mmol/L`
                : "—"}
            </p>
            <p className="mt-0.5 text-[0.65rem] text-gray-500">
              Media di (max−min) giornaliero · giorni con ≥2 campioni: {variability.daysWithGlucoseGte2}
            </p>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-black/30 px-3 py-2">
            <p className="font-mono text-[0.55rem] uppercase tracking-wider text-orange-200/90">Ampiezza media (lac)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">
              {variability.lactateMeanDailyRange != null && Number.isFinite(variability.lactateMeanDailyRange)
                ? `${formatStat(variability.lactateMeanDailyRange, 2)} mmol/L`
                : "—"}
            </p>
            <p className="mt-0.5 text-[0.65rem] text-gray-500">
              Media di (max−min) giornaliero · giorni con ≥2 campioni: {variability.daysWithLactateGte2}
            </p>
          </div>
        </div>
      ) : null}

      {skippedSchema ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-400">
          Storage time-series non disponibile su questo ambiente (schema).
        </p>
      ) : null}

      {!skippedSchema && !hasChart ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-400">
          Nessun campione glucosio/lattato nel range: il grafico compare quando ci sono punti in tabella 055.
        </p>
      ) : null}

      {hasChart ? (
        <div className="h-[min(260px,48vw)] min-h-[200px] w-full min-w-0 rounded-xl border border-white/10 bg-black/25 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: hasLac ? 44 : 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                type="number"
                dataKey="tsMs"
                domain={["dataMin", "dataMax"]}
                scale="time"
                tickFormatter={formatTickMs}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                minTickGap={28}
              />
              {hasGlu ? (
                <YAxis
                  yAxisId="glu"
                  orientation="left"
                  width={36}
                  tick={{ fill: GLU_COLOR, fontSize: 10 }}
                  tickFormatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v))}
                  label={{ value: "Glu", angle: -90, position: "insideLeft", fill: GLU_COLOR, fontSize: 10 }}
                />
              ) : null}
              {hasLac ? (
                <YAxis
                  yAxisId="lac"
                  orientation="right"
                  width={36}
                  tick={{ fill: LAC_COLOR, fontSize: 10 }}
                  tickFormatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v))}
                  label={{ value: "Lac", angle: 90, position: "insideRight", fill: LAC_COLOR, fontSize: 10 }}
                />
              ) : null}
              <Tooltip
                contentStyle={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8 }}
                labelFormatter={(ms) => (typeof ms === "number" ? new Date(ms).toLocaleString("it-IT") : String(ms))}
                formatter={(value: number, name: string) => [
                  value != null && Number.isFinite(value) ? `${value.toFixed(2)} mmol/L` : "—",
                  name === "glucoseMmolL" ? "Glucosio" : "Lattato",
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => (value === "glucoseMmolL" ? "Glucosio" : "Lattato")}
              />
              {hasGlu ? (
                <Line
                  yAxisId="glu"
                  type="monotone"
                  dataKey="glucoseMmolL"
                  name="glucoseMmolL"
                  stroke={GLU_COLOR}
                  dot={false}
                  strokeWidth={2}
                  connectNulls={false}
                />
              ) : null}
              {hasLac ? (
                <Line
                  yAxisId="lac"
                  type="monotone"
                  dataKey="lactateMmolL"
                  name="lactateMmolL"
                  stroke={LAC_COLOR}
                  dot={false}
                  strokeWidth={2}
                  connectNulls={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {!skippedSchema && dailyRollups.length > 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/20">
          <p className="border-b border-white/10 px-3 py-2 font-mono text-[0.6rem] uppercase tracking-wider text-gray-400">
            Sintesi per giorno (UTC) · n · min–max · media
          </p>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="sticky top-0 bg-zinc-950/95 text-[0.6rem] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2 text-fuchsia-200/90">Glucosio</th>
                  <th className="px-3 py-2 text-orange-200/90">Lattato</th>
                </tr>
              </thead>
              <tbody>
                {dailyRollups.map((d) => (
                  <tr key={d.dateUtc} className="border-t border-white/5">
                    <td className="px-3 py-1.5 font-mono text-white">{d.dateUtc}</td>
                    <td className="px-3 py-1.5 tabular-nums">{formatChannelCell(d.glucose)}</td>
                    <td className="px-3 py-1.5 tabular-nums">{formatChannelCell(d.lactate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
