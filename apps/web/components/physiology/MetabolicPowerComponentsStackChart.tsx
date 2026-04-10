"use client";

import type { PowerComponentRow } from "@/lib/engines/critical-power-engine";

export type MetabolicPowerComponentsStackChartProps = {
  rows: PowerComponentRow[];
  /** Motore CP attivo (da `METABOLIC_CP_ENGINE_REVISION`); se assente non mostriamo la riga build. */
  engineRevision?: string;
};

/**
 * Barre impilate: P(t) = CP + W′/t ripartito in ossidativo residuo, PCr (cinetica e⁻ᵗ/ᵗ) e glicolisi (quota iperbolica + parallela a soglia).
 */
export function MetabolicPowerComponentsStackChart({ rows, engineRevision }: MetabolicPowerComponentsStackChartProps) {
  if (!rows.length) return null;

  return (
    <div className="metabolic-comp-stack-card" aria-label="Scomposizione potenza modello: ossidativo, PCr e glicolisi per durata">
      <div className="metabolic-comp-stack-head">
        <h4 className="metabolic-comp-stack-title">Tre componenti metaboliche · quota di potenza per durata</h4>
        <p className="metabolic-comp-stack-caption">
          <strong>P(t) = CP + W′/t</strong> con CP/W′ da fit <strong>work–time</strong> quando R² è alto.{" "}
          <strong style={{ color: "#7dd3fc" }}>PCr</strong>: <strong>P<sub>PCr</sub> = min(W′/t, (E<sub>PCr</sub>/t)·e<sup>−t/τ</sup>)</strong>.{" "}
          <strong style={{ color: "#fbbf24" }}>Glicolisi</strong>: quota iperbolica <strong>W′/t − P<sub>PCr</sub></strong> + quota parallela a soglia{" "}
          <strong>CP·f<sub>∥</sub>(t)</strong> (cresce con log t). <strong style={{ color: "#34d399" }}>Ossidativo</strong> = residuo. Non V̇La di lab.
        </p>
      </div>
      <div className="metabolic-comp-stack-rows">
        {rows.map((row) => {
          const p = Math.max(1, row.modelPowerW);
          const pctA = (row.aerobicW / p) * 100;
          const pctP = (row.pcrW / p) * 100;
          const pctG = (row.glycolyticW / p) * 100;
          return (
            <div key={row.sec} className="metabolic-comp-stack-row">
              <span className="metabolic-comp-stack-lab">{row.label}</span>
              <div className="metabolic-comp-stack-track" title={`P=${row.modelPowerW.toFixed(0)} W`}>
                <div
                  className="metabolic-comp-stack-seg metabolic-comp-stack-seg--aer"
                  style={{ width: `${pctA}%` }}
                  title={`Ossidativo ${row.aerobicW.toFixed(0)} W`}
                />
                <div
                  className="metabolic-comp-stack-seg metabolic-comp-stack-seg--pcr"
                  style={{ width: `${pctP}%` }}
                  title={`PCr ${row.pcrW.toFixed(0)} W`}
                />
                <div
                  className="metabolic-comp-stack-seg metabolic-comp-stack-seg--gly"
                  style={{ width: `${pctG}%` }}
                  title={`Glicolisi ${row.glycolyticW.toFixed(0)} W`}
                />
              </div>
              <span className="metabolic-comp-stack-total">{row.modelPowerW.toFixed(0)} W</span>
            </div>
          );
        })}
      </div>
      <ul className="metabolic-comp-stack-legend">
        <li>
          <span className="metabolic-comp-stack-dot metabolic-comp-stack-dot--aer" /> Ossidativo
        </li>
        <li>
          <span className="metabolic-comp-stack-dot metabolic-comp-stack-dot--pcr" /> PCr
        </li>
        <li>
          <span className="metabolic-comp-stack-dot metabolic-comp-stack-dot--gly" /> Glicolisi
        </li>
      </ul>
      {engineRevision ? (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: "0.68rem",
            lineHeight: 1.4,
            color: "var(--empathy-text-muted)",
            fontFamily: "ui-monospace, monospace",
            wordBreak: "break-word",
          }}
        >
          Motore attivo: <strong style={{ color: "var(--empathy-text-secondary)" }}>{engineRevision}</strong>
          {" — "}
          se in produzione vedi ancora kJ PCr/glic <em>identici</em> su tutte le durate, il deploy non include questa revisione.
        </p>
      ) : null}
    </div>
  );
}
