"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { Brain } from "lucide-react";
import {
  estimatePeakBloodLactateMmol,
  steadyStateBloodLactateMmol,
} from "@/lib/physiology/lactate-steady-state-curve";

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Asse orizzontale: da moderato fino oltre FTP (zona verso VO₂max); il picco ematico da sforzo massimo è fuori da questa curva di stato stazionario. */
const X_PCT_MIN = 60;
const X_PCT_MAX = 115;

export type LactateThresholdPro2PanelProps = {
  ftpW: number;
  lt1W: number;
  lt2W: number;
  vlamax: number;
  /** VO₂max di riferimento (es. da Metabolic Profile) — solo contesto in UI, non sposta la curva. */
  vo2maxMlMinKg?: number | null;
  /** Intensità corrente %FTP (marker sulla curva, da input Lactate). */
  currentIntensityPctFtp?: number | null;
};

const CHART_W = 420;
const CHART_H = 192;
const PAD_L = 52;
const PAD_R = 14;
const PAD_T = 10;
const PAD_B = 30;

/**
 * BLa **stimata in stato stazionario** vs %FTP — curva liscia monotona (PCHIP, `steadyStateBloodLactateMmol`).
 * A ~100% FTP la stima resta in fascia MLSS (~4–6 mmol/L), non al picco da VO₂max.
 * Il picco ematico da sforzo massimo è riportato a parte (`estimatePeakBloodLactateMmol`).
 */
export function LactateThresholdPro2Panel({
  ftpW,
  lt1W,
  lt2W,
  vlamax,
  vo2maxMlMinKg,
  currentIntensityPctFtp,
}: LactateThresholdPro2PanelProps) {
  const gradId = useId().replace(/:/g, "");
  const ftp = Math.max(1, ftpW);
  const lt1Pct = clamp((lt1W / ftp) * 100, 58, 88);
  const lt2Pct = clamp((lt2W / ftp) * 100, lt1Pct + 4, 97);
  const xSpan = X_PCT_MAX - X_PCT_MIN;

  const points = useMemo(() => {
    const out: { pct: number; mmol: number }[] = [];
    for (let pct = X_PCT_MIN; pct <= X_PCT_MAX + 0.0001; pct += 0.35) {
      out.push({
        pct,
        mmol: steadyStateBloodLactateMmol({
          pctFtp: pct,
          lt1Pct,
          lt2Pct,
          vlamax,
        }),
      });
    }
    return out;
  }, [lt1Pct, lt2Pct, vlamax]);

  const maxMmol = useMemo(() => Math.max(...points.map((p) => p.mmol), 6), [points]);
  const yMax = Math.max(6, Math.ceil((maxMmol * 1.2) / 2) * 2);
  const yTicks = useMemo(() => {
    const out: number[] = [];
    for (let t = 0; t <= yMax + 0.01; t += 2) out.push(t);
    if (out[out.length - 1]! < yMax - 0.01) out.push(yMax);
    return out;
  }, [yMax]);

  const peakLactateMmol = useMemo(() => estimatePeakBloodLactateMmol(vlamax), [vlamax]);
  const blaAtFtp = useMemo(
    () =>
      steadyStateBloodLactateMmol({
        pctFtp: 100,
        lt1Pct,
        lt2Pct,
        vlamax,
      }),
    [lt1Pct, lt2Pct, vlamax],
  );

  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;

  const xScale = useCallback(
    (pct: number) => PAD_L + ((pct - X_PCT_MIN) / xSpan) * innerW,
    [innerW, xSpan],
  );
  const yScale = useCallback((mmol: number) => PAD_T + innerH - (mmol / yMax) * innerH, [innerH, yMax]);

  const areaPath = useMemo(() => {
    const line = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.pct).toFixed(2)} ${yScale(p.mmol).toFixed(2)}`)
      .join(" ");
    const last = points[points.length - 1];
    const first = points[0];
    return `${line} L ${xScale(last.pct).toFixed(2)} ${(PAD_T + innerH).toFixed(2)} L ${xScale(first.pct).toFixed(2)} ${(PAD_T + innerH).toFixed(2)} Z`;
  }, [points, xScale, yScale, innerH]);

  const linePath = useMemo(() => {
    return points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.pct).toFixed(2)} ${yScale(p.mmol).toFixed(2)}`)
      .join(" ");
  }, [points, xScale, yScale]);

  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const mmolAtPctInterpolated = useCallback(
    (pct: number) => {
      const x = clamp(pct, X_PCT_MIN, X_PCT_MAX);
      return steadyStateBloodLactateMmol({
        pctFtp: x,
        lt1Pct,
        lt2Pct,
        vlamax,
      });
    },
    [lt1Pct, lt2Pct, vlamax],
  );

  const hoverPoint = useMemo(() => {
    if (hoverPct == null) return null;
    const pct = clamp(hoverPct, X_PCT_MIN, X_PCT_MAX);
    return { pct, mmol: mmolAtPctInterpolated(pct) };
  }, [hoverPct, mmolAtPctInterpolated]);

  const onSvgMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const pct = X_PCT_MIN + ((x - PAD_L) / innerW) * xSpan;
    if (pct >= X_PCT_MIN && pct <= X_PCT_MAX) setHoverPct(pct);
    else setHoverPct(null);
  };

  const markerPct =
    currentIntensityPctFtp != null ? clamp(currentIntensityPctFtp, X_PCT_MIN, X_PCT_MAX) : null;
  const markerMmol = markerPct != null ? mmolAtPctInterpolated(markerPct) : null;

  const xGrid = [60, 70, 80, 85, 90, 95, 100, 110, 115];

  const vo2Line =
    vo2maxMlMinKg != null && Number.isFinite(vo2maxMlMinKg) && vo2maxMlMinKg >= 30
      ? `VO₂max riferimento: ${vo2maxMlMinKg.toFixed(1)} ml/kg/min · `
      : "";

  return (
    <div className="physiology-pro2-lactate-card" aria-label="Lactate threshold analysis Pro 2">
      <div className="physiology-pro2-lactate-head">
        <div className="physiology-pro2-lactate-head-left">
          <div className="physiology-pro2-lactate-head-title-row">
            <div className="physiology-pro2-lactate-ico" aria-hidden>
              <Brain size={20} strokeWidth={1.75} />
            </div>
            <h3 className="physiology-pro2-lactate-title">Lactate Threshold Analysis</h3>
          </div>
          <p className="physiology-pro2-lactate-caption">
            {vo2Line}
            Curva: <strong>BLa di stato stazionario stimata</strong> vs %FTP (60–115%). A 100% FTP resta in fascia{" "}
            <strong>MLSS (~4–6 mmol/L)</strong>, non al picco da sforzo massimo. Oltre FTP la curva sale in modo moderato (accumulo); il{" "}
            <strong>picco VO₂max</strong> è nel riquadro sotto, non sul punto 100%.
          </p>
        </div>
        <div className="physiology-pro2-lactate-vlamax">
          Indice glicolitico (proxy): <span className="physiology-pro2-lactate-vlamax-value">{vlamax.toFixed(2)}</span>
          <span className="physiology-pro2-lactate-vlamax-unit"> · non è VLamax da lab (mmol·L⁻¹·s⁻¹)</span>
        </div>
      </div>

      <div className="physiology-pro2-lactate-chart-wrap">
        <svg
          className="physiology-pro2-lactate-svg"
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={onSvgMove}
          onMouseLeave={() => setHoverPct(null)}
          role="img"
        >
          <defs>
            <linearGradient id={`${gradId}-lactate-line`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff8c00" />
              <stop offset="55%" stopColor="#ff5a8a" />
              <stop offset="100%" stopColor="#e11d8c" />
            </linearGradient>
            <linearGradient id={`${gradId}-lactate-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 107, 0, 0.5)" />
              <stop offset="45%" stopColor="rgba(200, 40, 120, 0.28)" />
              <stop offset="100%" stopColor="rgba(20, 8, 40, 0.92)" />
            </linearGradient>
          </defs>

          {yTicks.map((t) => (
            <g key={`gy-${t}`}>
              <line
                className="physiology-pro2-lactate-grid-h"
                x1={PAD_L}
                x2={CHART_W - PAD_R}
                y1={yScale(t)}
                y2={yScale(t)}
              />
              <text className="physiology-pro2-lactate-axis-y" x={PAD_L - 8} y={yScale(t) + 4} textAnchor="end">
                {t}
              </text>
            </g>
          ))}

          {xGrid.map((pct) => (
            <line
              key={`gx-${pct}`}
              className="physiology-pro2-lactate-grid-v"
              x1={xScale(pct)}
              x2={xScale(pct)}
              y1={PAD_T}
              y2={PAD_T + innerH}
            />
          ))}

          <g className="physiology-pro2-lactate-ftp-ref" aria-hidden>
            <line
              x1={xScale(100)}
              x2={xScale(100)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="rgba(52, 211, 153, 0.55)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <text
              x={xScale(100) + 4}
              y={PAD_T + 11}
              fill="rgba(52, 211, 153, 0.9)"
              fontSize={9}
              fontWeight={700}
              fontFamily="system-ui, sans-serif"
            >
              FTP · MLSS
            </text>
          </g>

          <text
            className="physiology-pro2-lactate-ylab"
            x={16}
            y={PAD_T + innerH / 2}
            transform={`rotate(-90 16 ${PAD_T + innerH / 2})`}
            textAnchor="middle"
          >
            Lactate (mmol/L)
          </text>

          {xGrid.map((pct) => (
            <text
              key={`lx-${pct}`}
              className="physiology-pro2-lactate-axis-x"
              x={xScale(pct)}
              y={CHART_H - 8}
              textAnchor="middle"
              fontSize={pct >= 110 ? 9 : 10}
            >
              {pct}%
            </text>
          ))}

          <g className="physiology-pro2-lactate-ftp-ref" aria-hidden>
            <line
              x1={xScale(100)}
              x2={xScale(100)}
              y1={PAD_T}
              y2={PAD_T + innerH}
              stroke="rgba(52, 211, 153, 0.55)"
              strokeWidth={1.35}
              strokeDasharray="5 4"
            />
            <text
              x={xScale(100)}
              y={PAD_T + 11}
              textAnchor="middle"
              fill="rgba(167, 243, 208, 0.92)"
              fontSize={9}
              fontWeight={800}
              fontFamily="system-ui, sans-serif"
            >
              FTP · MLSS
            </text>
          </g>

          <path d={areaPath} fill={`url(#${gradId}-lactate-fill)`} className="physiology-pro2-lactate-area" />
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${gradId}-lactate-line)`}
            strokeWidth={2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {markerPct != null && markerMmol != null && (
            <g className="physiology-pro2-lactate-marker">
              <line
                x1={xScale(markerPct)}
                x2={xScale(markerPct)}
                y1={PAD_T}
                y2={PAD_T + innerH}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <circle cx={xScale(markerPct)} cy={yScale(markerMmol)} r={5} fill="#fff" stroke="rgba(255,140,0,0.9)" strokeWidth={2} />
            </g>
          )}

          {hoverPoint && (
            <g className="physiology-pro2-lactate-hover">
              <line
                x1={xScale(hoverPoint.pct)}
                x2={xScale(hoverPoint.pct)}
                y1={PAD_T}
                y2={PAD_T + innerH}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth={1}
              />
              <circle cx={xScale(hoverPoint.pct)} cy={yScale(hoverPoint.mmol)} r={4.5} fill="#fff" />
              <g transform={`translate(${xScale(hoverPoint.pct) + 6}, ${yScale(hoverPoint.mmol) - 40})`}>
                <rect width={112} height={46} rx={8} ry={8} fill="rgba(6,8,12,0.96)" stroke="rgba(255,255,255,0.18)" />
                <text x={12} y={20} fill="#f8fafc" fontSize={12} fontWeight={700} fontFamily="system-ui, sans-serif">
                  {Math.round(hoverPoint.pct)}%
                </text>
                <text x={12} y={36} fill="#ff8c42" fontSize={11} fontWeight={600} fontFamily="system-ui, sans-serif">
                  {`lactate : ${hoverPoint.mmol.toFixed(1)}`}
                </text>
              </g>
            </g>
          )}
        </svg>
      </div>

      <div className="physiology-pro2-lactate-kpis">
        <div className="physiology-pro2-lactate-kpi physiology-pro2-lactate-kpi--lt1">
          <div className="physiology-pro2-lactate-kpi-label">LT1 (Aerobic)</div>
          <div className="physiology-pro2-lactate-kpi-value">{Math.round(lt1W)}W</div>
          <div className="physiology-pro2-lactate-kpi-sub">@ 2.0 mmol/L</div>
        </div>
        <div className="physiology-pro2-lactate-kpi physiology-pro2-lactate-kpi--lt2">
          <div className="physiology-pro2-lactate-kpi-label">LT2 (Anaerobic)</div>
          <div className="physiology-pro2-lactate-kpi-value">{Math.round(lt2W)}W</div>
          <div className="physiology-pro2-lactate-kpi-sub">@ 4.0 mmol/L</div>
        </div>
        <div className="physiology-pro2-lactate-kpi physiology-pro2-lactate-kpi--max">
          <div className="physiology-pro2-lactate-kpi-label">BLa @ FTP (MLSS)</div>
          <div className="physiology-pro2-lactate-kpi-value">{blaAtFtp.toFixed(1)}</div>
          <div className="physiology-pro2-lactate-kpi-sub">mmol/L · stato stazionario</div>
        </div>
      </div>
      <p className="physiology-pro2-lactate-footnote">
        Picco ematico stimato per <strong>sforzo massimo tipo VO₂max</strong> (non la BLa a 100% FTP):{" "}
        <strong>{peakLactateMmol.toFixed(1)} mmol/L</strong> — schematico dal proxy glicolitico; valori reali da protocollo e prelievo.
      </p>
    </div>
  );
}
