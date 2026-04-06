"use client";

import { colorForIntensity } from "@/lib/training/builder/pro2-intensity";
import type { ChartSegment } from "@/lib/training/engine/block-chart-segments";

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  if (s === 0) return `${m}′`;
  return `${m}′${s.toString().padStart(2, "0")}″`;
}

/**
 * Timeline: larghezza ∝ secondi, altezza ∝ score intensità.
 * Etichette sotto ogni segmento (tempo + zona colorata) — niente lista separata.
 */
export function SessionBlockIntensityChart({
  segments,
  title = "Grafico a blocchi (intensità)",
  estimatedTss,
}: {
  segments: ChartSegment[];
  title?: string;
  /** Stima TSS (IF² normalizzato: 60′ Z4 ≈ 100). */
  estimatedTss?: number;
}) {
  const totalSec = segments.reduce((s, x) => s + x.durationSeconds, 0) || 1;

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-950/35 via-fuchsia-950/15 to-black/40 px-4 py-6 text-center text-sm text-gray-500 shadow-inner shadow-violet-950/30">
        Nessun blocco da visualizzare.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-fuchsia-300 to-orange-300">
          {title}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.65rem] text-gray-500">
          <span>
            {formatSec(totalSec)} totali · {segments.length} segmenti
          </span>
          {typeof estimatedTss === "number" ? (
            <span className="rounded-full border border-orange-400/35 bg-gradient-to-r from-violet-600/35 to-fuchsia-600/35 px-2 py-0.5 font-bold text-orange-50 shadow-sm shadow-fuchsia-500/20">
              TSS ~{estimatedTss}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="rounded-xl border border-fuchsia-500/25 bg-gradient-to-b from-violet-950/35 via-black/60 to-black/75 p-2 shadow-inner shadow-fuchsia-950/20 ring-1 ring-violet-500/15"
        role="img"
        aria-label={`Timeline sessione, ${totalSec} secondi`}
      >
        <div className="flex min-h-[11rem] gap-1">
          {segments.map((seg) => {
            const heightScore = seg.barIntensityScore ?? seg.intensityScore;
            const pct = (heightScore / 7) * 100;
            const h = Math.max(22, pct);
            const zoneColor = colorForIntensity(seg.intensityLabel);
            /** Piramide: stessa zona ma target diverso → scala luminosità col gradiente lineare. */
            const pyramidBright =
              typeof seg.pyramidLinearT === "number"
                ? 0.78 + seg.pyramidLinearT * 0.42
                : 1;
            return (
              <div
                key={seg.id}
                className="flex min-w-0 flex-col"
                style={{ flexGrow: Math.max(1, seg.durationSeconds), flexBasis: 0 }}
              >
                <div className="flex min-h-[7.5rem] flex-1 flex-col justify-end">
                  <div
                    className="mx-0.5 rounded-t-lg shadow-[inset_0_-2px_0_rgba(0,0,0,0.35)] ring-1 ring-violet-400/25 transition hover:brightness-110"
                    style={{
                      height: `${h}%`,
                      minHeight: "2.25rem",
                      backgroundColor: zoneColor,
                      boxShadow: `0 0 18px ${zoneColor}55`,
                      filter: typeof seg.pyramidLinearT === "number" ? `brightness(${pyramidBright}) saturate(1.08)` : undefined,
                    }}
                    title={`${seg.label}: ${formatSec(seg.durationSeconds)}, ${seg.intensityLabel}`}
                  />
                </div>
                <div className="mt-1.5 px-0.5 text-center">
                  <p className="truncate font-mono text-[0.62rem] font-semibold leading-tight text-white/95">{formatSec(seg.durationSeconds)}</p>
                  <p
                    className="truncate text-[0.62rem] font-bold leading-tight"
                    style={{ color: zoneColor }}
                  >
                    {seg.intensityLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[0.6rem] leading-relaxed text-gray-600">
        Colori = zona; larghezza = tempo. Altezza = carico (piramide: incremento lineare su W/bpm, non solo etichetta zona).
        {typeof estimatedTss === "number" ? (
          <>
            {" "}
            TSS stimato: modello somma <span className="text-violet-400/90">IF²</span> per segmento, calibrato su{" "}
            <span className="text-fuchsia-400/85">60′ in Z4 ≈ 100 TSS</span>.
          </>
        ) : null}
      </p>
    </div>
  );
}
