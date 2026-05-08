"use client";

import { Heart, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { SleepHypnogramChart } from "@/components/physiology/SleepHypnogramChart";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { cn } from "@/lib/cn";
import type { PhysiologyDailyPanelOk } from "@/lib/physiology/daily-wellness-panel";

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; panel: PhysiologyDailyPanelOk }
  | { kind: "error"; message: string };

const KPI_TONE: Record<
  "fuchsia" | "violet" | "orange" | "cyan" | "emerald" | "sky",
  { border: string; label: string }
> = {
  fuchsia: { border: "border-fuchsia-500/25", label: "text-fuchsia-300" },
  violet: { border: "border-violet-500/25", label: "text-violet-300" },
  orange: { border: "border-orange-500/25", label: "text-orange-300" },
  cyan: { border: "border-cyan-500/25", label: "text-cyan-300" },
  emerald: { border: "border-emerald-500/25", label: "text-emerald-300" },
  sky: { border: "border-sky-500/25", label: "text-sky-300" },
};

function fmtNumber(value: number | null | undefined, digits: number): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function fmtInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toString();
}

function fmtHoursLabel(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${String(m).padStart(2, "0")}`;
}

function KpiCell({
  label,
  value,
  unit,
  tone = "cyan",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: keyof typeof KPI_TONE;
}) {
  const t = KPI_TONE[tone];
  return (
    <div className={cn("rounded-2xl border bg-black/40 px-4 py-3", t.border)}>
      <p className={cn("font-mono text-[0.6rem] font-bold uppercase tracking-wider", t.label)}>{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-white">
        {value}
        {unit ? <span className="ml-1 text-sm font-medium text-zinc-400">{unit}</span> : null}
      </p>
    </div>
  );
}

export type CalendarDayWellnessDetailProps = {
  athleteId: string | null | undefined;
  selectedDate: string;
};

export function CalendarDayWellnessDetail({ athleteId, selectedDate }: CalendarDayWellnessDetailProps) {
  const [state, setState] = useState<LoadState>({ kind: "idle" });

  const panel = state.kind === "ok" ? state.panel : null;

  useEffect(() => {
    if (!athleteId || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      try {
        const q = new URLSearchParams({ athleteId, date: selectedDate });
        const headers = await buildSupabaseAuthHeaders();
        const res = await fetch(`/api/health/daily-wellness?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers,
        });
        const json = (await res.json()) as PhysiologyDailyPanelOk | { ok: false; error?: string };
        if (cancelled) return;
        if (!res.ok || !("ok" in json) || !json.ok) {
          setState({
            kind: "error",
            message: ("error" in json && json.error) || res.statusText || "Errore caricamento.",
          });
          return;
        }
        setState({ kind: "ok", panel: json });
      } catch (err) {
        if (cancelled) return;
        setState({ kind: "error", message: err instanceof Error ? err.message : "Errore di rete." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, selectedDate]);

  const subtitle = `Sonno · recovery · giornata · ${selectedDate}`;

  if (!athleteId) {
    return null;
  }

  if (state.kind === "loading") {
    return (
      <div id="day-wellness-detail" className="scroll-mt-24">
        <Pro2SectionCard accent="emerald" title="Giornata · wellness" subtitle={subtitle} icon={Moon}>
          <p className="text-sm text-zinc-500">Carico panel giornata…</p>
        </Pro2SectionCard>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div id="day-wellness-detail" className="scroll-mt-24">
        <Pro2SectionCard accent="emerald" title="Giornata · wellness" subtitle={subtitle} icon={Moon}>
          <p className="text-sm text-amber-300/90">Lettura non riuscita: {state.message}</p>
        </Pro2SectionCard>
      </div>
    );
  }

  if (state.kind !== "ok" || !panel) return null;

  const totalSleepHours = (() => {
    const stages = panel.sleepStages;
    const partial = (stages.deepHours ?? 0) + (stages.lightHours ?? 0) + (stages.remHours ?? 0);
    if (partial > 0) return partial;
    return null;
  })();
  const recoveryScore = panel.recovery?.recoveryScore ?? null;
  const hrvMs = panel.recovery?.hrvMs ?? null;
  const restingHr = panel.recovery?.restingHrBpm ?? null;
  const sleepDurH = panel.recovery?.sleepDurationHours ?? totalSleepHours;

  const stagesBars = [
    { key: "deep", label: "Profondo", color: "#22d3ee", value: panel.sleepStages.deepHours },
    { key: "rem", label: "REM", color: "#a78bfa", value: panel.sleepStages.remHours },
    { key: "light", label: "Leggero", color: "#34d399", value: panel.sleepStages.lightHours },
    { key: "awake", label: "Sveglia", color: "#fb923c", value: panel.sleepStages.awakeHours },
  ];

  const hasAnyKpi =
    sleepDurH != null ||
    recoveryScore != null ||
    hrvMs != null ||
    restingHr != null ||
    panel.activity.steps != null ||
    panel.activity.activeCaloriesKcal != null;

  return (
    <div id="day-wellness-detail" className="scroll-mt-24">
      <Pro2SectionCard accent="emerald" title="Giornata · wellness" subtitle={subtitle} icon={Moon}>
        {!hasAnyKpi ? (
          <p className="text-sm text-zinc-500">
            Nessun dato giornata disponibile (collega Garmin/Whoop oppure carica un pannello Health con
            <code className="mx-1 rounded bg-white/5 px-1 py-0.5 font-mono text-xs">sample_date</code>
            allineato a {selectedDate}).
          </p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              <KpiCell label="Sonno totale" value={fmtHoursLabel(sleepDurH)} tone="violet" />
              <KpiCell label="HRV" value={fmtInt(hrvMs)} unit="ms" tone="emerald" />
              <KpiCell label="FC riposo" value={fmtInt(restingHr)} unit="bpm" tone="fuchsia" />
              <KpiCell
                label="Recovery"
                value={recoveryScore != null ? fmtInt(recoveryScore) : "—"}
                unit={recoveryScore != null ? "%" : undefined}
                tone="cyan"
              />
              <KpiCell label="Passi" value={fmtInt(panel.activity.steps)} tone="orange" />
              <KpiCell
                label="Calorie attive"
                value={fmtInt(panel.activity.activeCaloriesKcal)}
                unit="kcal"
                tone="orange"
              />
              <KpiCell
                label="Resp."
                value={fmtNumber(panel.activity.respiratoryRateRpm, 1)}
                unit="rpm"
                tone="sky"
              />
              <KpiCell
                label="Temp pelle"
                value={fmtNumber(panel.activity.skinTempC, 1)}
                unit="°C"
                tone="orange"
              />
            </div>

            <div>
              <p className="mb-2 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-zinc-400">
                Fasi sonno (ore)
              </p>
              <div className="space-y-2">
                {stagesBars.map((row) => {
                  const value = row.value ?? 0;
                  const total = stagesBars.reduce((acc, r) => acc + (r.value ?? 0), 0);
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  return (
                    <div key={row.key} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-xs text-zinc-400">{row.label}</span>
                      <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full"
                          style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: row.color }}
                        />
                      </div>
                      <span className="w-16 text-right font-mono text-xs tabular-nums text-zinc-200">
                        {fmtHoursLabel(row.value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {panel.sleepHypnogram.length > 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <p className="mb-2 flex items-center gap-2 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-emerald-300">
                  <Heart className="h-3.5 w-3.5" aria-hidden /> Fasi · linea notte
                </p>
                <SleepHypnogramChart
                  segments={panel.sleepHypnogram}
                  approximated={panel.sleepHypnogramApproximated}
                  sleepStartUtc={panel.sleepHypnogramWindowUtc?.sleepStartUtc}
                  sleepEndUtc={panel.sleepHypnogramWindowUtc?.sleepEndUtc}
                />
              </div>
            ) : null}

            {panel.notes.length > 0 ? (
              <ul className="space-y-1 text-xs text-zinc-500">
                {panel.notes.map((n) => (
                  <li key={n}>• {n}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </Pro2SectionCard>
    </div>
  );
}
