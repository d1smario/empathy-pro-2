"use client";

import { useId } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TelemetryChartRow = {
  t: string;
  power: number;
  hr: number;
  altitude: number;
};

type Props = {
  data: TelemetryChartRow[];
};

function downsampleRows(rows: TelemetryChartRow[], maxPoints: number): TelemetryChartRow[] {
  if (rows.length <= maxPoints) return rows;
  const step = rows.length / maxPoints;
  const out: TelemetryChartRow[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const idx = Math.min(rows.length - 1, Math.round(i * step));
    out.push(rows[idx]);
  }
  return out;
}

export function TrainingCalendarTelemetryChart({ data }: Props) {
  const gid = useId().replace(/:/g, "");
  const plot = downsampleRows(data, 520);
  if (plot.length < 2) return null;
  const powFill = `tcPow-${gid}`;
  const altFill = `tcAlt-${gid}`;

  return (
    <div className="space-y-3">
      <div className="h-[min(300px,42vw)] min-h-[220px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={plot} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id={powFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.85} />
                <stop offset="50%" stopColor="#a855f7" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="t" tick={{ fill: "#94a3b8", fontSize: 10 }} interval="preserveStartEnd" minTickGap={28} />
            <YAxis
              yAxisId="pow"
              orientation="left"
              tick={{ fill: "#fdba74", fontSize: 10 }}
              width={44}
              domain={["auto", "auto"]}
              label={{ value: "W", angle: -90, position: "insideLeft", fill: "#fb923c", fontSize: 10 }}
            />
            <YAxis
              yAxisId="hr"
              orientation="right"
              tick={{ fill: "#fca5a5", fontSize: 10 }}
              width={40}
              domain={["auto", "auto"]}
              label={{ value: "bpm", angle: 90, position: "insideRight", fill: "#f87171", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(167, 139, 250, 0.35)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: number, name: string) => {
                const v = Number.isFinite(value) ? value.toFixed(0) : "—";
                if (name === "power") return [`${v} W`, "Potenza"];
                if (name === "hr") return [`${v} bpm`, "FC"];
                return [v, name];
              }}
            />
            <Area
              yAxisId="pow"
              type="monotone"
              dataKey="power"
              stroke="#f97316"
              strokeWidth={2}
              fill={`url(#${powFill})`}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="hr"
              type="monotone"
              dataKey="hr"
              stroke="#ef4444"
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[min(140px,22vw)] min-h-[100px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={plot} margin={{ top: 4, right: 8, left: 4, bottom: 2 }}>
            <defs>
              <linearGradient id={altFill} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.65} />
                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.08} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="t" hide />
            <YAxis
              tick={{ fill: "#67e8f9", fontSize: 10 }}
              width={44}
              domain={["auto", "auto"]}
              label={{ value: "m", angle: -90, position: "insideLeft", fill: "#22d3ee", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(34, 211, 238, 0.35)",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${Number.isFinite(value) ? value.toFixed(0) : "—"} m`, "Quota"]}
            />
            <Area
              type="monotone"
              dataKey="altitude"
              stroke="#06b6d4"
              strokeWidth={1.5}
              fill={`url(#${altFill})`}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">
        Potenza (area) · FC linea rossa · Quota (area sotto)
      </p>
    </div>
  );
}
