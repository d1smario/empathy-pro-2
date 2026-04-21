"use client";

import type { LactateEngineOutput } from "@/lib/engines/lactate-engine";

export type LactateEnginePro2VizProps = {
  model: LactateEngineOutput;
  choGapG: number;
};

type Seg = { key: string; label: string; value: number; tone: string };

function pct(part: number, whole: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

function SegmentedBar({ segments, unit }: { segments: Seg[]; unit: string }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const denom = total > 0 ? total : 1;
  return (
    <div className="lactate-engine-viz-bar-wrap">
      <div
        className="lactate-engine-viz-bar-track"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value.toFixed(1)} ${unit}`).join(", ")}
      >
        {segments.map((seg) => {
          const w = (Math.max(0, seg.value) / denom) * 100;
          if (w < 0.05) return null;
          return (
            <div
              key={seg.key}
              className={`lactate-engine-viz-bar-seg lactate-engine-viz-bar-seg--${seg.tone}`}
              style={{ width: `${w}%` }}
              title={`${seg.label}: ${seg.value.toFixed(2)} ${unit}`}
            />
          );
        })}
      </div>
      <ul className="lactate-engine-viz-legend">
        {segments.map((seg) => (
          <li key={seg.key}>
            <span className={`lactate-engine-viz-dot lactate-engine-viz-dot--${seg.tone}`} />
            <span className="lactate-engine-viz-legend-label">{seg.label}</span>
            <span className="lactate-engine-viz-legend-val">
              {seg.value.toFixed(1)} {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MeterRow({ label, value01, tone }: { label: string; value01: number; tone: string }) {
  const p = pct(value01 * 100, 100);
  return (
    <div className="lactate-engine-viz-meter">
      <div className="lactate-engine-viz-meter-head">
        <span>{label}</span>
        <span className="lactate-engine-viz-meter-pct">{(value01 * 100).toFixed(0)}%</span>
      </div>
      <div className="lactate-engine-viz-meter-track">
        <div className={`lactate-engine-viz-meter-fill lactate-engine-viz-meter-fill--${tone}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/**
 * Grafica Pro2 per l’output del motore lattato: split energetico, destino lattato, pipeline CHO, indicatori gut.
 * Complementare al report (`LactatePro2EngineReport`) e alla curva LT (`LactateThresholdPro2Panel`).
 */
export function LactateEnginePro2Viz({ model, choGapG }: LactateEnginePro2VizProps) {
  const E = Math.max(1e-6, model.energyDemandKcal);
  const energySegs: Seg[] = [
    { key: "cho", label: "Energia da CHO", value: model.choKcal, tone: "amber" },
    { key: "noncho", label: "Energia da non-CHO", value: model.nonChoKcal, tone: "cyan" },
  ];

  const oxSegs: Seg[] = [
    { key: "aer", label: "Aerobico (tetto VO₂)", value: model.aerobicKcal, tone: "cyan" },
    { key: "ana", label: "Contributo anaerobico", value: model.anaerobicKcal, tone: "rose" },
  ];

  const lacSegs: Seg[] = [
    { key: "ox", label: "Ossidato (MCT1)", value: model.lactateOxidizedG, tone: "cyan" },
    { key: "cori", label: "Ciclo di Cori", value: model.lactateCoriG, tone: "violet" },
    { key: "acc", label: "Accumulato", value: model.lactateAccumG, tone: "rose" },
  ];

  const ing = model.choIngestedTotalG;
  const nonAbsorbedG = Math.max(0, ing - model.choAfterAbsorptionG);
  const pipeSegs: Seg[] = [
    { key: "nab", label: "Non assorbito (uscita intestinale)", value: nonAbsorbedG, tone: "slate" },
    { key: "seq", label: "Sequestro microbiota", value: model.microbiotaSequestrationG, tone: "rose" },
    { key: "blood", label: "Pool disponibile / sangue", value: model.choIntoBloodstreamG, tone: "amber" },
  ];

  const riskTone =
    model.gutPathwayRisk === "high" ? "rose" : model.gutPathwayRisk === "moderate" ? "amber" : "green";

  return (
    <div className="lactate-engine-viz">
      <div className="lactate-engine-viz-card">
        <h4 className="lactate-engine-viz-title">Bilancio energetico · split substrati</h4>
        <p className="lactate-engine-viz-sub">
          Domanda totale <strong>{model.energyDemandKcal.toFixed(0)} kcal</strong> · quota glicolitica {model.glycolyticSharePct.toFixed(0)}% · RER implicito nel motore
        </p>
        {model.profileMetabolicCouplingActive ? (
          <p className="lactate-engine-viz-hint" style={{ marginTop: 6 }}>
            Profilo CP+W′: modulazione anaerobica/lattato (hint {(model.profileAnaerobicModulation01 * 100).toFixed(0)}%) da sostenibilità iperbolica e proxy glicolitico.
          </p>
        ) : null}
        <SegmentedBar segments={energySegs} unit="kcal" />
      </div>

      <div className="lactate-engine-viz-card">
        <h4 className="lactate-engine-viz-title">Aerobico vs anaerobico (kcal)</h4>
        <p className="lactate-engine-viz-sub">
          Copertura aerobica {pct(model.aerobicKcal, E).toFixed(0)}% · contributo anaerobico {pct(model.anaerobicKcal, E).toFixed(0)}%
        </p>
        <SegmentedBar segments={oxSegs} unit="kcal" />
      </div>

      <div className="lactate-engine-viz-card">
        <h4 className="lactate-engine-viz-title">Destino del lattato · massa (g)</h4>
        <p className="lactate-engine-viz-sub">
          Prodotto <strong>{model.lactateProducedG.toFixed(1)} g</strong> (anaerobio {model.lactateFromAnaerobicGlycolysisG.toFixed(1)} · aerobio{" "}
          {model.lactateFromAerobicGlycolysisG.toFixed(1)}) · glicogeno lordo {model.glycogenCombustedGrossG.toFixed(1)} g
        </p>
        <SegmentedBar segments={lacSegs} unit="g" />
        <p className="lactate-engine-viz-hint">
          Tre destini sul prodotto: ossidazione {model.lactateFateOxidationPct.toFixed(0)}% · Cori {model.lactateFateCoriPct.toFixed(0)}% · accumulo{" "}
          {model.lactateFateAccumPct.toFixed(0)}%
        </p>
      </div>

      <div className="lactate-engine-viz-card">
        <h4 className="lactate-engine-viz-title">Pipeline CHO in seduta (g)</h4>
        <p className="lactate-engine-viz-sub">
          Ingeriti totali <strong>{model.choIngestedTotalG.toFixed(1)} g</strong> · ossidati esogeni {model.exogenousOxidizedG.toFixed(1)} g · CHO gap strategia{" "}
          <strong style={{ color: choGapG > 15 ? "#ff5d5d" : choGapG > 5 ? "#ffd60a" : "#00e08d" }}>{choGapG.toFixed(0)} g</strong>
          {model.bloodGlucoseMmolL != null ? (
            <>
              {" "}
              · glucosiemia sensore <strong>{model.bloodGlucoseMmolL.toFixed(2)} mmol/L</strong>
            </>
          ) : null}
        </p>
        <SegmentedBar segments={pipeSegs} unit="g" />
        <p className="lactate-engine-viz-hint">
          Assorbimento intestinale (CHO attraverso parete) {model.gutAbsorptionYieldPctOfIngested.toFixed(0)}% dell’ingerito · entrata pool ematico{" "}
          {model.bloodDeliveryPctOfIngested.toFixed(0)}% dell’ingerito · sequestro microbiota effettivo {model.effectiveSequestrationPct.toFixed(1)}%
        </p>
        <p className="lactate-engine-viz-hint">
          Massa: assorbito {model.choAfterAbsorptionG.toFixed(1)} g · disponibile circolo {model.choAvailableG.toFixed(1)} g (post-sequestro)
        </p>
      </div>

      <div className="lactate-engine-viz-card lactate-engine-viz-card--gut">
        <h4 className="lactate-engine-viz-title">Intestino · microbiota · rischio pathway</h4>
        <p className="lactate-engine-viz-sub">
          Rischio pathway: <span className={`lactate-engine-viz-risk lactate-engine-viz-risk--${riskTone}`}>{model.gutPathwayRisk}</span>
        </p>
        <div className="lactate-engine-viz-meter-grid">
          <MeterRow label="Dysbiosis score" value01={model.microbiotaDysbiosisScore} tone="rose" />
          <MeterRow label="Gut stress" value01={model.gutStressScore} tone="amber" />
          <MeterRow label="Fermentation load" value01={model.fermentationLoadScore} tone="violet" />
        </div>
        <div className="lactate-engine-viz-mini-kpis">
          <div>
            <span className="lactate-engine-viz-mini-label">Glicogeno netto</span>
            <span className="lactate-engine-viz-mini-val">{model.glycogenCombustedNetG.toFixed(1)} g</span>
          </div>
          <div>
            <span className="lactate-engine-viz-mini-label">Glucosio richiesto</span>
            <span className="lactate-engine-viz-mini-val">{model.glucoseRequiredForStrategyG.toFixed(1)} g</span>
          </div>
          <div>
            <span className="lactate-engine-viz-mini-label">Glucosio da Cori</span>
            <span className="lactate-engine-viz-mini-val">{model.glucoseFromCoriG.toFixed(1)} g</span>
          </div>
          <div>
            <span className="lactate-engine-viz-mini-label">Costo Cori</span>
            <span className="lactate-engine-viz-mini-val">{model.coriCostKcal.toFixed(0)} kcal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
