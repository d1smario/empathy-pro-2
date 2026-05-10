"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type {
  BioenergeticContinuousMonitoringDay,
  BioenergeticMetricTileCategory,
  BioenergeticMonitoringDataPlane,
} from "@/api/bioenergetics/contracts";

const CATEGORY_ORDER: BioenergeticMetricTileCategory[] = [
  "metabolic",
  "inflammatory",
  "hormonal",
  "neural",
  "gastro_intestinal",
  "gonadal",
];

function planeLabel(plane: BioenergeticMonitoringDataPlane): string {
  if (plane === "measured_stream") return "Stream";
  if (plane === "sparse_lab_hold") return "Lab tenuto";
  return "Modello";
}

function planeBadgeClass(plane: BioenergeticMonitoringDataPlane): string {
  if (plane === "measured_stream") return "border-emerald-400/40 text-emerald-200/90";
  if (plane === "sparse_lab_hold") return "border-sky-400/40 text-sky-200/90";
  return "border-amber-400/40 text-amber-200/90";
}

type Props = {
  monitoring: BioenergeticContinuousMonitoringDay;
};

export function BioenergeticsContinuousMonitoringGrid({ monitoring }: Props) {
  const sorted = [...monitoring.channels].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {sorted.map((ch) => {
        const rows = ch.hourly.map((v, hour) => ({
          hourLabel: `${String(hour).padStart(2, "0")}:00`,
          v: v == null || Number.isNaN(v) ? null : v,
        }));
        const hasData = rows.some((r) => r.v != null);
        if (!hasData) return null;

        return (
          <div
            key={ch.id}
            className="rounded-2xl border border-white/10 bg-black/30 p-3 shadow-inner shadow-black/40"
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium leading-snug text-white">{ch.labelIt}</p>
                <p className="text-[0.65rem] text-gray-500">{ch.unit}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-md border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide ${planeBadgeClass(ch.dataPlane)}`}
                >
                  {planeLabel(ch.dataPlane)}
                </span>
                {ch.replacesWithDeviceStream ? (
                  <span className="text-[0.55rem] uppercase tracking-wide text-fuchsia-300/80">Slot stream</span>
                ) : null}
              </div>
            </div>
            <div className="h-[88px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="hourLabel" tick={false} height={0} />
                  <YAxis width={32} tick={{ fill: "#64748b", fontSize: 9 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(167, 139, 250, 0.3)",
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                    formatter={(value) => {
                      const v = typeof value === "number" ? value : Number(value);
                      return Number.isFinite(v) ? [`${v.toFixed(3)}`, ch.labelIt] : ["—", ch.labelIt];
                    }}
                    labelFormatter={(l) => String(l)}
                  />
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="#c084fc"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
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
