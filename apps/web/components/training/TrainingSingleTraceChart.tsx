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

type TrainingSingleTraceChartProps = {
  label: string;
  color: string;
  values: number[];
  labels: string[];
  unit?: string;
};

export function TrainingSingleTraceChart({
  label,
  color,
  values,
  labels,
  unit,
}: TrainingSingleTraceChartProps) {
  const fillId = useId().replace(/:/g, "");
  if (!values.length) return null;
  const data = values.map((v, i) => ({
    t: labels[i] ?? `s${i + 1}`,
    v: Number.isFinite(v) ? v : 0,
  }));

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="t" tick={{ fill: "#94a3b8", fontSize: 10 }} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={44} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(148,163,184,0.35)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#e2e8f0" }}
            formatter={(val: number) => [`${Number.isFinite(val) ? val.toFixed(2) : "0.00"}${unit ? ` ${unit}` : ""}`, label]}
          />
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.55} />
              <stop offset="92%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke="transparent"
            fill={`url(#${fillId})`}
            fillOpacity={1}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2.2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
