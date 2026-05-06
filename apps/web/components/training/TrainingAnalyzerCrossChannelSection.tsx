"use client";

import { Activity } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import type { CrossChannelSessionVm } from "@/lib/training/analytics/cross-channel-session";

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildChartData(session: CrossChannelSessionVm): Array<{ tSec: number; tLabel: string; power: number | null; hr: number | null; glucose: number | null }> {
  const power = session.powerSeries;
  const hr = session.hrSeries;
  const samples = Math.max(power.length, hr.length, 2);
  const dt = session.durationSeconds / Math.max(1, samples - 1);
  const data: Array<{ tSec: number; tLabel: string; power: number | null; hr: number | null; glucose: number | null }> = [];
  for (let i = 0; i < samples; i += 1) {
    const tSec = Math.round(i * dt);
    data.push({
      tSec,
      tLabel: fmtTime(tSec),
      power: power[i] != null && Number.isFinite(power[i]) ? power[i] : null,
      hr: hr[i] != null && Number.isFinite(hr[i]) ? hr[i] : null,
      glucose: null,
    });
  }
  // Glucosio come scatter su tSec → trovo l'indice più vicino
  for (const point of session.glucosePoints) {
    if (!data.length) break;
    const idx = Math.min(
      data.length - 1,
      Math.max(0, Math.round((point.tSec / Math.max(1, session.durationSeconds)) * (data.length - 1))),
    );
    data[idx] = { ...data[idx], glucose: point.mmol };
  }
  return data;
}

export function TrainingAnalyzerCrossChannelSection({
  sessions,
}: {
  sessions: CrossChannelSessionVm[];
}) {
  const [activeId, setActiveId] = useState<string | null>(sessions[0]?.executedId ?? null);
  const active = useMemo(
    () => (activeId ? sessions.find((s) => s.executedId === activeId) ?? sessions[0] ?? null : sessions[0] ?? null),
    [activeId, sessions],
  );
  const chartData = useMemo(() => (active ? buildChartData(active) : []), [active]);

  if (!sessions.length) {
    return null;
  }

  return (
    <div className="mb-6">
      <Pro2SectionCard
        accent="cyan"
        title="Cross-channel intra-sessione"
        subtitle="Power / FC vs glucosio CGM nello stesso intervallo della sessione"
        icon={Activity}
      >
        <div className="mb-3 flex flex-wrap gap-2">
          {sessions.map((s) => {
            const isActive = active?.executedId === s.executedId;
            return (
              <button
                key={s.executedId}
                type="button"
                onClick={() => setActiveId(s.executedId)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                  isActive
                    ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                    : "border-white/10 bg-black/40 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                }`}
              >
                {s.date ?? s.executedId.slice(0, 6)} · {fmtTime(s.durationSeconds)}
              </button>
            );
          })}
        </div>

        {active ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis
                    dataKey="tLabel"
                    tick={{ fill: "#94a3b8", fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={32}
                  />
                  <YAxis yAxisId="left" tick={{ fill: "#f0abfc", fontSize: 10 }} width={40} domain={["auto", "auto"]} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: "#22d3ee", fontSize: 10 }}
                    width={40}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(148,163,184,0.35)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  {active.hasPower ? (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="power"
                      stroke="#f0abfc"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      name="Power (W)"
                    />
                  ) : null}
                  {active.hasHr ? (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="hr"
                      stroke="#34d399"
                      strokeWidth={1.6}
                      dot={false}
                      isAnimationActive={false}
                      name="FC (bpm)"
                    />
                  ) : null}
                  {active.hasGlucose ? (
                    <Scatter
                      yAxisId="right"
                      dataKey="glucose"
                      fill="#22d3ee"
                      shape="circle"
                      name="Glucosio (mmol/L)"
                    />
                  ) : null}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
              {active.hasPower ? (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#f0abfc]" /> Power
                </span>
              ) : null}
              {active.hasHr ? (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#34d399]" /> FC
                </span>
              ) : null}
              {active.hasGlucose ? (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#22d3ee]" /> Glucosio (asse dx)
                </span>
              ) : null}
              {!active.hasGlucose ? (
                <span className="text-amber-300/80">Nessun campione CGM nell&apos;intervallo della sessione.</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </Pro2SectionCard>
    </div>
  );
}
