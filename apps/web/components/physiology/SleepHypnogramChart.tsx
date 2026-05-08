"use client";

import { cn } from "@/lib/cn";

/** 0 sveglio · 1 leggero · 2 profondo · 3 REM */
export const SLEEP_HYPNO_STAGE_FILL: Record<number, string> = {
  0: "#7dd3fc",
  1: "#a1a1aa",
  2: "#fb923c",
  3: "#f472b6",
};

const LEGEND: Array<{ stage: number; label: string }> = [
  { stage: 0, label: "Risveglio" },
  { stage: 1, label: "Leggero" },
  { stage: 2, label: "Profondo" },
  { stage: 3, label: "REM" },
];

function formatAxisTime(iso: string | null | undefined, locale = "it-IT"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export type SleepHypnogramSegment = { t0: number; t1: number; stage: number };

export function SleepHypnogramChart({
  segments,
  approximated = false,
  sleepStartUtc,
  sleepEndUtc,
  className,
}: {
  segments: SleepHypnogramSegment[];
  approximated?: boolean;
  sleepStartUtc?: string | null;
  sleepEndUtc?: string | null;
  className?: string;
}) {
  const w = 400;
  const bandTop = 8;
  const bandH = 56;
  const h = bandTop + bandH + 36;

  if (!segments.length) {
    return (
      <div className={cn("rounded-xl border border-white/10 bg-black/40 p-4", className)}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-white">Sonno · fasi</p>
            <p className="text-xs text-gray-500">
              Nessun dato fasi per questa notte: assicurati che l’export includa sonno e stadi mappati.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const hasWindow = Boolean(sleepStartUtc && sleepEndUtc);

  return (
    <div className={cn("rounded-xl border border-violet-500/25 bg-violet-950/10 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-white">Sonno · fasi (linea temporale)</p>
          <p className="text-xs text-gray-500">
            {approximated
              ? "Modello ricostruito dai totali per stadio (WHOOP API non espone la sequenza reale). Non è l’ipnogramma clinico del dispositivo."
              : "Sequenza da segmenti vendor quando disponibili."}
          </p>
        </div>
        {hasWindow ? (
          <div className="text-right font-mono text-[0.65rem] uppercase text-gray-400">
            <div>{formatAxisTime(sleepStartUtc)}</div>
            <div className="text-gray-600">→</div>
            <div>{formatAxisTime(sleepEndUtc)}</div>
          </div>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-3 h-40 w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Distribuzione delle fasi del sonno sulla notte"
      >
        <title>Distribuzione delle fasi del sonno sulla notte</title>
        <rect width={w} height={h} fill="transparent" />

        {/* Asse */}
        <line
          x1={8}
          y1={bandTop + bandH + 8}
          x2={w - 8}
          y2={bandTop + bandH + 8}
          stroke="rgba(148,163,184,0.35)"
          strokeWidth={1}
        />

        {segments.map((seg, idx) => {
          const fill = SLEEP_HYPNO_STAGE_FILL[seg.stage] ?? "#64748b";
          const x0 = 8 + seg.t0 * (w - 16);
          const x1 = 8 + seg.t1 * (w - 16);
          const rw = Math.max(0.5, x1 - x0);
          return (
            <rect
              key={`${idx}-${seg.t0}-${seg.stage}`}
              x={x0}
              y={bandTop}
              width={rw}
              height={bandH}
              rx={2}
              fill={fill}
              opacity={0.92}
            />
          );
        })}

        <text x={8} y={bandTop - 2} fill="rgba(148,163,184,0.85)" fontSize={9} fontFamily="monospace">
          Inizio notte
        </text>
        <text
          x={w - 8}
          y={bandTop - 2}
          fill="rgba(148,163,184,0.85)"
          fontSize={9}
          fontFamily="monospace"
          textAnchor="end"
        >
          Sveglia
        </text>
      </svg>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[0.65rem] text-gray-400">
        {LEGEND.map((L) => (
          <li key={L.stage} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: SLEEP_HYPNO_STAGE_FILL[L.stage] ?? "#64748b" }}
              aria-hidden
            />
            {L.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
