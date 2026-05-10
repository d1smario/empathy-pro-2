"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type {
  BioenergeticChannelCurveResolutionV1,
  BioenergeticContinuousMonitoringDay,
  BioenergeticMetricTileCategory,
  BioenergeticMonitoringDataPlane,
} from "@/api/bioenergetics/contracts";
import type { BioenergeticCurveGovernanceHintV1 } from "@empathy/contracts";

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

function governanceIt(g: BioenergeticCurveGovernanceHintV1): string {
  if (g === "measurement_wins") return "Policy: vince la misura Empathy";
  if (g === "deterministic_engine_wins") return "Policy: motore / pareggio (contesto ricco vs sim)";
  return "Policy: fase iniziale — prevale curva AI supervisionata (sim come fallback oggi)";
}

function fusionSummary(res: BioenergeticChannelCurveResolutionV1): string {
  const dm = Math.round(res.deterministicWeight01 * 100);
  const ai = Math.round(res.aiProposalWeight01 * 100);
  const r = Math.round(res.internalContextRichness01 * 100);
  return `Fusione v${res.fusionContractVersion}: motore ${dm}% · AI ${ai}% · ricchezza contesto ${r}%`;
}

type Props = {
  monitoring: BioenergeticContinuousMonitoringDay;
};

const CHART_H = 92;

/** Recharts con dominio [v,v] non disegna la linea: aggiunge padding simmetrico. */
function yDomainFromHourly(hourly: (number | null)[]): [number, number] {
  const nums = hourly.filter((x): x is number => x != null && Number.isFinite(x));
  if (!nums.length) return [0, 1];
  const mn = Math.min(...nums);
  const mx = Math.max(...nums);
  if (mn === mx) {
    const pad = Math.max(Math.abs(mn) * 0.06, 0.02);
    return [mn - pad, mx + pad];
  }
  const span = mx - mn;
  const pad = Math.max(span * 0.08, span * 0.01);
  return [mn - pad, mx + pad];
}

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

        const yDomain = yDomainFromHourly(ch.hourly);

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
            {ch.curveResolution ? (
              <p className="mb-2 text-[0.58rem] leading-snug text-gray-400">
                {fusionSummary(ch.curveResolution)}
                <span className="text-gray-500"> · </span>
                <span className="text-violet-200/85">{governanceIt(ch.curveResolution.governance)}</span>
              </p>
            ) : null}
            <div className="w-full min-w-[160px]" style={{ height: CHART_H }}>
              <ResponsiveContainer width="100%" height={CHART_H} debounce={50}>
                <LineChart data={rows} margin={{ top: 6, right: 2, left: 2, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="2 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="hourLabel" tick={false} axisLine={false} tickLine={false} height={1} />
                  <YAxis
                    width={36}
                    tick={{ fill: "#94a3b8", fontSize: 9 }}
                    domain={yDomain}
                    axisLine={false}
                    tickLine={false}
                  />
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
                    stroke="#e879f9"
                    strokeWidth={2}
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
