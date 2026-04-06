"use client";

import { useId } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export type RadarAxisRow = {
  subject: string;
  /** 0–100 vs picco mensile sulla stessa finestra */
  pct: number;
  sessionW: number | null;
  monthPeakW: number | null;
  /** Unità per tooltip (W, bpm, rpm, …). */
  unit?: string;
};

type PayloadEntry = { payload?: RadarAxisRow };

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: RadarAxisRow }>;
}) {
  if (!active || !payload?.length) return null;
  const p = (payload[0] as PayloadEntry).payload;
  if (!p) return null;
  const sw = p.sessionW;
  const mp = p.monthPeakW;
  return (
    <div className="rounded-xl border border-pink-500/30 bg-slate-950/95 px-3 py-2 text-xs text-slate-200 shadow-lg">
      <p className="font-bold text-pink-200">{p.subject}</p>
      <p className="mt-1 tabular-nums">
        Sessione: {sw != null && sw > 0 ? `${Math.round(sw)} ${p.unit ?? "W"}` : "—"}
        <br />
        Picco mese: {mp != null && mp > 0 ? `${Math.round(mp)} ${p.unit ?? "W"}` : "—"}
        <br />
        Indice: {Math.round(p.pct)}%
      </p>
    </div>
  );
}

type Props = {
  rows: RadarAxisRow[];
  subtitle?: string;
  /** Default unità nel tooltip se manca su ogni riga. */
  valueUnit?: string;
};

export function TrainingPowerProfileRadar({ rows, subtitle, valueUnit = "W" }: Props) {
  const gradId = useId().replace(/:/g, "");
  const data = rows.map((r) => ({
    subject: r.subject,
    pct: Math.max(0, Math.min(100, r.pct)),
    sessionW: r.sessionW,
    monthPeakW: r.monthPeakW,
    unit: r.unit ?? valueUnit,
  }));

  if (!data.length) return null;

  return (
    <div className="min-w-0">
      <div className="h-[min(300px,85vw)] min-h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="52%" outerRadius="72%">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ec4899" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <PolarGrid stroke="rgba(255,255,255,0.12)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
            <Radar
              name="% vs picco mese"
              dataKey="pct"
              stroke="#f472b6"
              strokeWidth={2}
              fill={`url(#${gradId})`}
              fillOpacity={0.85}
              isAnimationActive={false}
            />
            <Tooltip content={<RadarTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {subtitle ? <p className="mt-2 text-center text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}
