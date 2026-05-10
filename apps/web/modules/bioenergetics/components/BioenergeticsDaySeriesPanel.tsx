"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BioenergeticDaySeriesChannel } from "@/api/bioenergetics/contracts";

function downsample<T>(rows: T[], maxPoints: number): T[] {
  if (rows.length <= maxPoints) return rows;
  const step = rows.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.min(rows.length - 1, Math.round(i * step));
    out.push(rows[idx]);
  }
  return out;
}

type ChartRow = { t: string; v: number };

function toChartRows(ch: BioenergeticDaySeriesChannel): ChartRow[] {
  const raw = ch.points.map((p) => ({
    t: p.ts.length >= 16 ? p.ts.slice(11, 16) : p.ts,
    v: p.value,
  }));
  return downsample(raw, 360);
}

type Props = {
  series: BioenergeticDaySeriesChannel[];
};

export function BioenergeticsDaySeriesPanel({ series }: Props) {
  const plot = series.filter((s) => s.points.length >= 2);
  if (!plot.length) {
    return <p className="text-xs text-gray-500">Nessuna serie temporale sufficiente per curve aggiuntive (serve almeno 2 punti per canale).</p>;
  }

  const strokeFor = (id: string): string => {
    if (id === "glucose_mmol") return "#c084fc";
    if (id === "lactate_mmol") return "#38bdf8";
    if (id === "meal_carbs_g_cumulative") return "#fbbf24";
    if (id === "hr_bpm") return "#fb7185";
    if (id === "power_w") return "#f472b6";
    if (id === "planned_power_w") return "#6ee7b7";
    if (id === "speed_kmh") return "#22d3ee";
    if (id === "cadence_rpm") return "#a78bfa";
    if (id === "altitude_m") return "#34d399";
    if (id === "temperature_c") return "#fb923c";
    return "#94a3b8";
  };

  const provenanceUi = (p: BioenergeticDaySeriesChannel["provenance"]): string => {
    if (p === "measured") return "misurato";
    if (p === "estimated") return "stimato";
    if (p === "planned") return "da piano";
    return "assente";
  };

  return (
    <div className="space-y-5">
      {plot.map((ch) => {
        const data = toChartRows(ch);
        return (
          <div key={ch.id} className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-white">{ch.labelIt}</p>
              <span className="text-[0.65rem] uppercase tracking-wide text-gray-500">
                {ch.unit} · {provenanceUi(ch.provenance)}
                {ch.sourceHint ? ` · ${ch.sourceHint}` : ""}
              </span>
            </div>
            <div className="h-[140px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 9 }} interval="preserveStartEnd" minTickGap={24} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} width={36} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(167, 139, 250, 0.35)",
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [String(v), ch.labelIt]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: "#64748b" }} />
                  <Line
                    type="monotone"
                    dataKey="v"
                    name={ch.labelIt}
                    stroke={strokeFor(ch.id)}
                    strokeWidth={ch.provenance === "planned" ? 1.25 : 1.5}
                    strokeDasharray={ch.provenance === "planned" ? "5 4" : undefined}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
