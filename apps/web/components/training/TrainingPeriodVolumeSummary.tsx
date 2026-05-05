"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  TrainingExecutedVolumeRollupViewModel,
  TrainingRecoveryContinuousRollupViewModel,
  TrainingAnalyticsViewModel,
} from "@/api/training/contracts";
import { fetchTrainingAnalyticsRows } from "@/modules/training/services/training-analytics-api";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { LineChart as LineChartIcon } from "lucide-react";
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

type PresetId = "7" | "28" | "90" | "365";

type SleepPoint = {
  date: string;
  sleep: number | null;
  deep: number | null;
  rem: number | null;
  light: number | null;
  hr: number | null;
  hrv: number | null;
};

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangeEndingToday(daysInclusive: number): { from: string; to: string } {
  const to = new Date();
  to.setHours(12, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - (daysInclusive - 1));
  return { from: toDateKey(from), to: toDateKey(to) };
}

const PRESETS: Array<{ id: PresetId; label: string; days: number }> = [
  { id: "7", label: "7g", days: 7 },
  { id: "28", label: "28g", days: 28 },
  { id: "90", label: "90g", days: 90 },
  { id: "365", label: "1 anno", days: 365 },
];

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function pick(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const key of keys) {
    const value = num(trace[key]);
    if (value != null) return value;
  }
  return null;
}

function formatRollup(r: TrainingExecutedVolumeRollupViewModel | null | undefined): {
  sessions: string;
  hours: string;
  tss: string;
  km: string;
  elev: string;
  kcal: string;
} {
  if (!r) return { sessions: "—", hours: "—", tss: "—", km: "—", elev: "—", kcal: "—" };
  const hours = r.durationMinutes / 60;
  return {
    sessions: String(r.sessionCount),
    hours: hours >= 10 ? hours.toFixed(1) : hours.toFixed(2),
    tss: r.tss >= 1 ? Math.round(r.tss).toString() : r.tss.toFixed(1),
    km: r.distanceKm >= 0.05 ? r.distanceKm.toFixed(1) : "0",
    elev: r.elevationGainM >= 1 ? Math.round(r.elevationGainM).toString() : r.elevationGainM.toFixed(0),
    kcal: r.kcal >= 1 ? Math.round(r.kcal).toString() : "—",
  };
}

function avg(values: Array<number | null>, digits = 2): number | null {
  const valid = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!valid.length) return null;
  const m = valid.reduce((s, v) => s + v, 0) / valid.length;
  return Number(m.toFixed(digits));
}

function asTrace(row: Record<string, unknown>): Record<string, unknown> | null {
  const t = row.trace_summary;
  return t && typeof t === "object" ? (t as Record<string, unknown>) : null;
}

export function TrainingPeriodVolumeSummary({ athleteId }: { athleteId: string | null }) {
  const [preset, setPreset] = useState<PresetId>("28");
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [rollup, setRollup] = useState<TrainingExecutedVolumeRollupViewModel | null>(null);
  const [recoveryRollup, setRecoveryRollup] = useState<TrainingRecoveryContinuousRollupViewModel | null>(null);
  const [analyticsVm, setAnalyticsVm] = useState<TrainingAnalyticsViewModel | null>(null);

  const bounds = useMemo(() => {
    const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[1];
    return rangeEndingToday(p.days);
  }, [preset]);

  useEffect(() => {
    if (!athleteId) {
      setRollup(null);
      setRecoveryRollup(null);
      setAnalyticsVm(null);
      setFetchErr(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFetchErr(null);
    void fetchTrainingAnalyticsRows({ athleteId, from: bounds.from, to: bounds.to }).then((vm) => {
      if (cancelled) return;
      setRollup(vm.executedVolumeRollup ?? null);
      setRecoveryRollup(vm.recoveryContinuousRollup ?? null);
      setAnalyticsVm(vm);
      setFetchErr(vm.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId, bounds.from, bounds.to]);

  const f = formatRollup(rollup);

  const sleepSeries = useMemo<SleepPoint[]>(() => {
    const rows = analyticsVm?.rows ?? [];
    return rows
      .map((row) => {
        const trace = asTrace(row);
        const sleep = pick(trace, ["sleep_hours", "total_sleep_hours", "sleep_duration_hours", "sleep_h"]);
        const deep = pick(trace, ["sleep_deep_hours", "deep_sleep_hours", "sleep_deep_h"]);
        const rem = pick(trace, ["sleep_rem_hours", "rem_sleep_hours", "sleep_rem_h"]);
        const light = pick(trace, ["sleep_light_hours", "light_sleep_hours", "sleep_light_h"]);
        const hr = pick(trace, ["resting_hr_bpm", "resting_heart_rate", "night_hr_bpm", "sleep_hr_bpm"]);
        const hrv = pick(trace, ["hrv_rmssd_ms", "hrv_rmssd_milli", "night_hrv_rmssd_ms", "rmssd"]);
        return {
          date: typeof row.date === "string" ? row.date : "",
          sleep,
          deep,
          rem,
          light,
          hr,
          hrv,
        };
      })
      .filter((r) => r.date)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [analyticsVm?.rows]);

  const biomarkerCells = useMemo(() => {
    const rows = analyticsVm?.rows ?? [];
    const traces = rows.map((r) => asTrace(r as Record<string, unknown>));
    const scan = (keys: string[]): number | null => {
      for (let i = traces.length - 1; i >= 0; i -= 1) {
        const value = pick(traces[i], keys);
        if (value != null) return value;
      }
      return null;
    };
    const latestLactate = (() => {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i] as Record<string, unknown>;
        const v = num(row.lactate_mmoll);
        if (v != null) return v;
        const t = asTrace(row);
        const tr = pick(t, ["lactate_mmol_l", "lactate_mmoll"]);
        if (tr != null) return tr;
      }
      return null;
    })();
    const latestGlucose = (() => {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const row = rows[i] as Record<string, unknown>;
        const v = num(row.glucose_mmol);
        if (v != null) return v;
        const t = asTrace(row);
        const tr = pick(t, ["glucose_mmol_l", "glucose_mmol"]);
        if (tr != null) return tr;
      }
      return null;
    })();
    return [
      { k: "VO₂", v: scan(["vo2_l_min", "vo2_lpm"]) != null ? `${scan(["vo2_l_min", "vo2_lpm"])?.toFixed(2)} L/min` : "—" },
      { k: "VCO₂", v: scan(["vco2_l_min", "vco2_lpm"]) != null ? `${scan(["vco2_l_min", "vco2_lpm"])?.toFixed(2)} L/min` : "—" },
      { k: "Glucosio", v: latestGlucose != null ? `${latestGlucose.toFixed(2)} mmol/L` : "—" },
      { k: "Testosterone", v: scan(["testosterone", "testosterone_ng_dl"]) != null ? `${Math.round(scan(["testosterone", "testosterone_ng_dl"]) ?? 0)} ng/dL` : "—" },
      { k: "Ossido nitrico", v: scan(["nitric_oxide", "nitric_oxide_index", "no_index"]) != null ? `${(scan(["nitric_oxide", "nitric_oxide_index", "no_index"]) ?? 0).toFixed(1)}` : "—" },
      { k: "Lattato", v: latestLactate != null ? `${latestLactate.toFixed(2)} mmol/L` : "—" },
      { k: "NAD", v: scan(["nad", "nad_plus", "nad_index"]) != null ? `${(scan(["nad", "nad_plus", "nad_index"]) ?? 0).toFixed(1)}` : "—" },
    ];
  }, [analyticsVm?.rows]);

  const avgCells = useMemo(() => {
    const sleepAvg = avg(sleepSeries.map((p) => p.sleep), 2);
    const deepAvg = avg(sleepSeries.map((p) => p.deep), 2);
    const remAvg = avg(sleepSeries.map((p) => p.rem), 2);
    const lightAvg = avg(sleepSeries.map((p) => p.light), 2);
    const hrAvg = avg(sleepSeries.map((p) => p.hr), 1);
    const hrvAvg = avg(sleepSeries.map((p) => p.hrv), 1);
    return [
      { k: "Sonno totale medio", v: sleepAvg != null ? `${sleepAvg.toFixed(2)} h` : "—" },
      { k: "Profondo medio", v: deepAvg != null ? `${deepAvg.toFixed(2)} h` : "—" },
      { k: "REM medio", v: remAvg != null ? `${remAvg.toFixed(2)} h` : "—" },
      { k: "Leggero medio", v: lightAvg != null ? `${lightAvg.toFixed(2)} h` : "—" },
      { k: "FC notturna media", v: hrAvg != null ? `${hrAvg.toFixed(1)} bpm` : "—" },
      { k: "HRV notturna media", v: hrvAvg != null ? `${hrvAvg.toFixed(1)} ms` : "—" },
    ];
  }, [sleepSeries]);

  return (
    <Pro2SectionCard
      accent="cyan"
      title="Volume aggregato · Analyzer"
      subtitle={`Eseguiti nella finestra ${bounds.from} → ${bounds.to} (serie + trace_summary)`}
      icon={LineChartIcon}
    >
      {!athleteId ? (
        <p className="text-sm text-amber-200/85">Seleziona un atleta attivo per caricare gli aggregati.</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                  preset === p.id
                    ? "border-cyan-400/55 bg-cyan-500/20 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.18)]"
                    : "border-white/15 bg-black/35 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {fetchErr ? <p className="mb-3 text-xs text-amber-300/90">{fetchErr}</p> : null}
          {loading ? (
            <div className="h-16 animate-pulse rounded-xl bg-cyan-500/10" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { k: "Sedute", v: f.sessions },
                  { k: "Ore", v: f.hours },
                  { k: "TSS", v: f.tss },
                  { k: "Distanza km", v: f.km },
                  { k: "Dislivello m", v: f.elev },
                  { k: "kcal", v: f.kcal },
                ].map((cell) => (
                  <div key={cell.k} className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-center shadow-inner">
                    <div className="font-mono text-lg font-bold text-cyan-100">{cell.v}</div>
                    <div className="mt-1 text-[0.62rem] font-semibold uppercase tracking-wider text-zinc-500">{cell.k}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { k: "Rest HR", v: recoveryRollup?.avgRestingHrBpm != null ? `${Math.round(recoveryRollup.avgRestingHrBpm)} bpm` : "—" },
                  { k: "HRV RMSSD", v: recoveryRollup?.avgHrvRmssdMs != null ? `${Math.round(recoveryRollup.avgHrvRmssdMs)} ms` : "—" },
                  { k: "Sonno medio", v: recoveryRollup?.avgSleepHours != null ? `${recoveryRollup.avgSleepHours.toFixed(2)} h` : "—" },
                  { k: "Skin temp", v: recoveryRollup?.avgSkinTempC != null ? `${recoveryRollup.avgSkinTempC.toFixed(2)} C` : "—" },
                  { k: "Sample rc", v: recoveryRollup != null ? String(recoveryRollup.sampleCount) : "0" },
                ].map((cell) => (
                  <div key={cell.k} className="rounded-xl border border-violet-500/20 bg-violet-950/15 px-3 py-3 text-center">
                    <div className="font-mono text-sm font-semibold text-violet-100">{cell.v}</div>
                    <div className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-zinc-500">{cell.k}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                  <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-wider text-zinc-500">Andamento sonno (totale/deep/REM/light)</p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sleepSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(34,211,238,0.35)" }} />
                        <Legend />
                        <Line type="monotone" dataKey="sleep" name="Totale h" stroke="#22d3ee" dot={false} connectNulls />
                        <Line type="monotone" dataKey="deep" name="Deep h" stroke="#a855f7" dot={false} connectNulls />
                        <Line type="monotone" dataKey="rem" name="REM h" stroke="#f472b6" dot={false} connectNulls />
                        <Line type="monotone" dataKey="light" name="Light h" stroke="#eab308" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                  <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-wider text-zinc-500">Andamento FC notturna / HRV notturna</p>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sleepSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#9ca3af", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#0a0a0c", border: "1px solid rgba(168,85,247,0.35)" }} />
                        <Legend />
                        <Line type="monotone" dataKey="hr" name="FC notturna" stroke="#f97316" dot={false} connectNulls />
                        <Line type="monotone" dataKey="hrv" name="HRV RMSSD" stroke="#34d399" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {avgCells.map((cell) => (
                  <div key={cell.k} className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-3 py-3 text-center">
                    <div className="font-mono text-sm font-semibold text-emerald-100">{cell.v}</div>
                    <div className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-zinc-500">{cell.k}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                {biomarkerCells.map((cell) => (
                  <div key={cell.k} className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/10 px-3 py-3 text-center">
                    <div className="font-mono text-sm font-semibold text-fuchsia-100">{cell.v}</div>
                    <div className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-zinc-500">{cell.k}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="mt-3 text-[0.65rem] leading-relaxed text-zinc-500">
            KPI da <code className="rounded border border-white/10 bg-white/5 px-1 text-zinc-400">GET /api/training/analytics</code> su trace reali.
            I campi non presenti nelle tracce restano "—" finche' non arrivano da ingest provider/lab.
          </p>
        </>
      )}
    </Pro2SectionCard>
  );
}
