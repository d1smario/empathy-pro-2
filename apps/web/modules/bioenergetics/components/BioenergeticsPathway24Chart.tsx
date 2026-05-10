"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BioenergeticHour24Point, BioenergeticPathwayImpact } from "@/api/bioenergetics/contracts";

const IMPACT_FILL: Record<BioenergeticPathwayImpact, string> = {
  supportive: "rgba(52, 211, 153, 0.75)",
  neutral: "rgba(148, 163, 184, 0.65)",
  inhibitory: "rgba(251, 113, 133, 0.75)",
};

type Row = BioenergeticHour24Point & { fill: string };

function toRows(points: BioenergeticHour24Point[]): Row[] {
  return points.map((p) => ({ ...p, fill: IMPACT_FILL[p.pathwayImpact] }));
}

type Props = {
  data: BioenergeticHour24Point[];
};

export function BioenergeticsPathway24Chart({ data }: Props) {
  const rows = toRows(data);
  const hasGlucose = rows.some((r) => r.glucoseMmol != null);
  const hasLactate = rows.some((r) => r.lactateMmol != null);
  const hasMetabolicMm = hasGlucose || hasLactate;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm" style={{ background: IMPACT_FILL.supportive }} />
          Supportivo
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm" style={{ background: IMPACT_FILL.neutral }} />
          Neutro
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-4 rounded-sm" style={{ background: IMPACT_FILL.inhibitory }} />
          Inibitorio
        </span>
      </div>

      <div
        className="flex gap-px rounded-lg border border-white/10 bg-black/30 p-1"
        role="img"
        aria-label="Fasce orarie: colore = impatto modello sulla via metabolica"
      >
        {rows.map((r) => (
          <div
            key={r.hour}
            className="min-h-[10px] flex-1 rounded-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: r.fill }}
            title={`${r.hourLabel}: ${r.pathwayImpact} (bilancio ${r.pathwayBalance})`}
          />
        ))}
      </div>

      <div className="h-[min(280px,42vw)] min-h-[220px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: hasMetabolicMm ? 52 : 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="hourLabel" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={3} minTickGap={18} />
            <YAxis
              yAxisId="bal"
              orientation="left"
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              width={40}
              domain={[-100, 100]}
              label={{ value: "Bilancio", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 9 }}
            />
            {hasMetabolicMm ? (
              <YAxis
                yAxisId="glu"
                orientation="right"
                tick={{ fill: "#c4b5fd", fontSize: 10 }}
                width={48}
                domain={["auto", "auto"]}
                label={{ value: "Glu / Lac mmol/L", angle: 90, position: "insideRight", fill: "#c4b5fd", fontSize: 9 }}
              />
            ) : null}
            <Tooltip
              contentStyle={{
                background: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(167, 139, 250, 0.35)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: number, name: string) => {
                if (name === "pathwayBalance") return [`${value}`, "Bilancio via (modello)"];
                if (name === "glucoseMmol" && value != null) return [`${Number(value).toFixed(2)} mmol/L`, "Glucosio"];
                if (name === "lactateMmol" && value != null) return [`${Number(value).toFixed(2)} mmol/L`, "Lattato"];
                return [String(value), name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            <ReferenceLine yAxisId="bal" y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <Area
              yAxisId="bal"
              type="monotone"
              dataKey="pathwayBalance"
              name="Bilancio via (area)"
              legendType="none"
              fill="rgba(249, 115, 22, 0.22)"
              stroke="rgba(249, 115, 22, 0.45)"
              strokeWidth={1}
              isAnimationActive={false}
            />
            <Line
              yAxisId="bal"
              type="monotone"
              dataKey="pathwayBalance"
              name="Bilancio via"
              stroke="#fb923c"
              strokeWidth={2.5}
              dot={(props: { cx?: number; cy?: number; payload?: Row }) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null || !payload) return <g />;
                return <circle cx={cx} cy={cy} r={4} fill={payload.fill} stroke="rgba(0,0,0,0.35)" strokeWidth={1} />;
              }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
            {hasGlucose ? (
              <Line
                yAxisId="glu"
                type="monotone"
                dataKey="glucoseMmol"
                name="Glucosio"
                stroke="#c084fc"
                strokeWidth={1.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
            {hasLactate ? (
              <Line
                yAxisId="glu"
                type="monotone"
                dataKey="lactateMmol"
                name="Lattato"
                stroke="#f472b6"
                strokeWidth={1.75}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
