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
import type { BioenergeticNominalEducationCurve24 } from "@/api/bioenergetics/contracts";

type Row = { hourLabel: string; cortisolUgdL: number; acthPgMl: number };

type Props = {
  curves: BioenergeticNominalEducationCurve24[];
};

export function BioenergeticsNominalHormone24Chart({ curves }: Props) {
  const cort = curves.find((c) => c.id === "cortisol_nominal_v1");
  const acth = curves.find((c) => c.id === "acth_nominal_v1");
  if (!cort?.hourly?.length || !acth?.hourly?.length || cort.hourly.length !== 24 || acth.hourly.length !== 24) {
    return null;
  }

  const rows: Row[] = Array.from({ length: 24 }, (_, h) => ({
    hourLabel: `${String(h).padStart(2, "0")}:00`,
    cortisolUgdL: cort.hourly[h] ?? NaN,
    acthPgMl: acth.hourly[h] ?? NaN,
  }));

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-amber-200/85">{cort.modelNote}</p>
      <div className="h-[min(220px,38vw)] min-h-[180px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 6, right: 52, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="hourLabel" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={3} minTickGap={18} />
            <YAxis
              yAxisId="cort"
              orientation="left"
              tick={{ fill: "#fb923c", fontSize: 10 }}
              width={44}
              domain={["auto", "auto"]}
              label={{ value: cort.unit, angle: -90, position: "insideLeft", fill: "#fb923c", fontSize: 9 }}
            />
            <YAxis
              yAxisId="acth"
              orientation="right"
              tick={{ fill: "#38bdf8", fontSize: 10 }}
              width={48}
              domain={["auto", "auto"]}
              label={{ value: acth.unit, angle: 90, position: "insideRight", fill: "#38bdf8", fontSize: 9 }}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(251, 146, 60, 0.35)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: number, name: string) => {
                if (name === "cortisolUgdL") return [`${Number(value).toFixed(1)}`, cort.labelIt];
                if (name === "acthPgMl") return [`${Number(value).toFixed(1)}`, acth.labelIt];
                return [String(value), name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            <Line
              yAxisId="cort"
              type="monotone"
              dataKey="cortisolUgdL"
              name={cort.labelIt}
              stroke="#fb923c"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="acth"
              type="monotone"
              dataKey="acthPgMl"
              name={acth.labelIt}
              stroke="#38bdf8"
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
