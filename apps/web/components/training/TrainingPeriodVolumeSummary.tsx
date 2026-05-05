"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  TrainingExecutedVolumeRollupViewModel,
  TrainingRecoveryContinuousRollupViewModel,
} from "@/api/training/contracts";
import { fetchTrainingAnalyticsRows } from "@/modules/training/services/training-analytics-api";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { LineChart } from "lucide-react";

type PresetId = "7" | "28" | "90" | "365";

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Ultimi N giorni inclusi con ancoraggio a oggi (mezzogiorno locale). */
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

function formatRollup(r: TrainingExecutedVolumeRollupViewModel | null | undefined): {
  sessions: string;
  hours: string;
  tss: string;
  km: string;
  elev: string;
  kcal: string;
} {
  if (!r) {
    return { sessions: "—", hours: "—", tss: "—", km: "—", elev: "—", kcal: "—" };
  }
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

export function TrainingPeriodVolumeSummary({ athleteId }: { athleteId: string | null }) {
  const [preset, setPreset] = useState<PresetId>("28");
  const [loading, setLoading] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [rollup, setRollup] = useState<TrainingExecutedVolumeRollupViewModel | null>(null);
  const [recoveryRollup, setRecoveryRollup] = useState<TrainingRecoveryContinuousRollupViewModel | null>(null);

  const bounds = useMemo(() => {
    const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[1];
    return rangeEndingToday(p.days);
  }, [preset]);

  useEffect(() => {
    if (!athleteId) {
      setRollup(null);
      setRecoveryRollup(null);
      setFetchErr(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFetchErr(null);
    void fetchTrainingAnalyticsRows({
      athleteId,
      from: bounds.from,
      to: bounds.to,
    }).then((vm) => {
      if (cancelled) return;
      setRollup(vm.executedVolumeRollup ?? null);
      setRecoveryRollup(vm.recoveryContinuousRollup ?? null);
      setFetchErr(vm.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [athleteId, bounds.from, bounds.to]);

  const f = formatRollup(rollup);

  return (
    <Pro2SectionCard
      accent="cyan"
      title="Volume aggregato · Analyzer"
      subtitle={`Eseguiti nella finestra ${bounds.from} → ${bounds.to} (serie + trace_summary)`}
      icon={LineChart}
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
                  <div
                    key={cell.k}
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-center shadow-inner"
                  >
                    <div className="font-mono text-lg font-bold text-cyan-100">{cell.v}</div>
                    <div className="mt-1 text-[0.62rem] font-semibold uppercase tracking-wider text-zinc-500">{cell.k}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  {
                    k: "Rest HR",
                    v:
                      recoveryRollup?.avgRestingHrBpm != null
                        ? `${Math.round(recoveryRollup.avgRestingHrBpm)} bpm`
                        : "—",
                  },
                  {
                    k: "HRV RMSSD",
                    v:
                      recoveryRollup?.avgHrvRmssdMs != null
                        ? `${Math.round(recoveryRollup.avgHrvRmssdMs)} ms`
                        : "—",
                  },
                  {
                    k: "Sonno medio",
                    v:
                      recoveryRollup?.avgSleepHours != null
                        ? `${recoveryRollup.avgSleepHours.toFixed(2)} h`
                        : "—",
                  },
                  {
                    k: "Skin temp",
                    v:
                      recoveryRollup?.avgSkinTempC != null
                        ? `${recoveryRollup.avgSkinTempC.toFixed(2)} C`
                        : "—",
                  },
                  {
                    k: "Sample rc",
                    v: recoveryRollup != null ? String(recoveryRollup.sampleCount) : "0",
                  },
                ].map((cell) => (
                  <div key={cell.k} className="rounded-xl border border-violet-500/20 bg-violet-950/15 px-3 py-3 text-center">
                    <div className="font-mono text-sm font-semibold text-violet-100">{cell.v}</div>
                    <div className="mt-1 text-[0.58rem] font-semibold uppercase tracking-wider text-zinc-500">{cell.k}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="mt-3 text-[0.65rem] leading-relaxed text-zinc-500">
            KPI da{' '}
            <code className="rounded border border-white/10 bg-white/5 px-1 text-zinc-400">GET /api/training/analytics</code> · rollup
            deterministico da traccia (km/dislivello quando presenti in import/sync).
          </p>
        </>
      )}
    </Pro2SectionCard>
  );
}
