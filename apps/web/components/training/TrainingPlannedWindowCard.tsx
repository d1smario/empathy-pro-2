"use client";

import { formatExecutedWorkoutSummary, type ExecutedWorkout, type PlannedWorkout } from "@empathy/domain-training";
import { formatPlannedWorkoutCardTitle } from "@/lib/training/planned/format-planned-workout-title";
import { useEffect, useState } from "react";
import type { TrainingPlannedWindowOkViewModel, TrainingTwinContextStripViewModel } from "@/api/training/contracts";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { TrainingPlannedWindowContextStrip } from "@/components/training/TrainingPlannedWindowContextStrip";
import { Pro2Link } from "@/components/ui/empathy";
import { cn } from "@/lib/cn";
import type { ReadSpineCoverageSummary } from "@/lib/platform/read-spine-coverage";
import { useActiveAthlete } from "@/lib/use-active-athlete";

type ApiErr = { ok: false; error?: string; planned?: []; executed?: [] };

/**
 * Fase 5 — pianificato + eseguito nella stessa finestra (default −7 / +28 giorni).
 */
export function TrainingPlannedWindowCard({ className }: { className?: string }) {
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [planned, setPlanned] = useState<PlannedWorkout[]>([]);
  const [executed, setExecuted] = useState<ExecutedWorkout[]>([]);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [readSpineCoverage, setReadSpineCoverage] = useState<ReadSpineCoverageSummary | null>(null);
  const [twinContextStrip, setTwinContextStrip] = useState<TrainingTwinContextStripViewModel | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setPlanned([]);
      setExecuted([]);
      setRange(null);
      setReadSpineCoverage(null);
      setTwinContextStrip(null);
      setErr("No active athlete: open Settings or complete profile (private / coach).");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const q = new URLSearchParams({ athleteId });
        const res = await fetch(`/api/training/planned-window?${q.toString()}`, {
          cache: "no-store",
          headers: await buildSupabaseAuthHeaders(),
        });
        const json = (await res.json()) as TrainingPlannedWindowOkViewModel | ApiErr;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setPlanned([]);
          setExecuted([]);
          setRange(null);
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
          setErr(("error" in json && json.error) || "Could not load data.");
          return;
        }
        setPlanned(json.planned);
        setExecuted(json.executed ?? []);
        setRange({ from: json.from, to: json.to });
        setReadSpineCoverage(json.readSpineCoverage ?? null);
        setTwinContextStrip(json.twinContextStrip ?? null);
      } catch {
        if (!cancelled) {
          setErr("Network error.");
          setReadSpineCoverage(null);
          setTwinContextStrip(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, ctxLoading]);

  const showEmptyLists =
    !ctxLoading && !loading && !err && planned.length === 0 && executed.length === 0;

  return (
    <section
      className={cn(
        "w-full max-w-lg rounded-2xl border border-white/10 bg-black/30 p-6 text-left backdrop-blur-md",
        className,
      )}
      aria-label="Training calendar"
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-orange-300">Training · live data</p>
      <h2 className="mt-2 text-lg font-bold text-white">Calendar</h2>
      {range ? (
        <p className="mt-1 font-mono text-xs text-gray-500">
          {range.from} → {range.to}
        </p>
      ) : null}

      {readSpineCoverage && !err ? (
        <TrainingPlannedWindowContextStrip
          className="mt-4"
          label="Calendar"
          readSpineCoverage={readSpineCoverage}
          twinContextStrip={twinContextStrip}
        />
      ) : null}

      {ctxLoading || loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-2 w-48 animate-pulse rounded-full bg-white/10" />
          <div className="h-2 w-40 animate-pulse rounded-full bg-white/10" />
        </div>
      ) : null}

      {!ctxLoading && !loading && err ? (
        <p className="mt-4 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {showEmptyLists ? (
        <p className="mt-4 text-sm text-gray-500">No planned or executed sessions in this window.</p>
      ) : null}

      {!ctxLoading && !loading && !err && planned.length > 0 ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <h3 className="font-mono text-[0.6rem] uppercase tracking-wider text-gray-500">Planned</h3>
          <ul className="mt-2 space-y-2">
            {planned.map((w) => (
              <li
                key={w.id}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-gray-500">{w.date}</span>
                    <span className="mx-2 text-gray-600">·</span>
                    {formatPlannedWorkoutCardTitle(w)}
                  </div>
                  <Pro2Link
                    href={`/training/session/${w.date}`}
                    variant="ghost"
                    className="shrink-0 border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs hover:bg-orange-500/15"
                  >
                    Day
                  </Pro2Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!ctxLoading && !loading && !err && executed.length > 0 ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <h3 className="font-mono text-[0.6rem] uppercase tracking-wider text-gray-500">Executed</h3>
          <ul className="mt-2 space-y-2">
            {executed.map((w) => (
              <li
                key={w.id}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-gray-500">{w.date}</span>
                    <span className="mx-2 text-gray-600">·</span>
                    {formatExecutedWorkoutSummary(w)}
                  </div>
                  <Pro2Link
                    href={`/training/session/${w.date}`}
                    variant="ghost"
                    className="shrink-0 border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs hover:bg-emerald-500/15"
                  >
                    Day
                  </Pro2Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
