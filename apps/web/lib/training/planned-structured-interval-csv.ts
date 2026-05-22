/** CSV scala intervalli (TrainingPeaks-style) — nessuna dipendenza server-only / FIT binary. */

import type { ZwoTextEvent } from "@/lib/training/builder/zwo-step-text-events";

export type StructuredIntervalRow = {
  index: number;
  durationSec: number;
  powerAvgW: number;
  powerLowW: number;
  powerHighW: number;
  durationType: string;
  kind: "steady" | "ramp";
  label?: string;
  zoneLabel?: string;
  coachNote?: string;
  textEvents?: ZwoTextEvent[];
};

export function formatDurationMmss(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${m}:${pad(ss)}`;
}

export function formatStructuredIntervalLadderCsv(rows: StructuredIntervalRow[]): string {
  const header =
    "index,duration_sec,duration_mmss,power_avg_w,power_low_w,power_high_w,duration_type,kind,label";
  const lines = [header];
  for (const r of rows) {
    const lab = r.label != null && r.label.trim() ? `"${r.label.replace(/"/g, '""')}"` : "";
    lines.push(
      [
        r.index,
        r.durationSec,
        formatDurationMmss(r.durationSec),
        r.powerAvgW,
        r.powerLowW,
        r.powerHighW,
        r.durationType,
        r.kind,
        lab,
      ].join(","),
    );
  }
  return lines.join("\n");
}
