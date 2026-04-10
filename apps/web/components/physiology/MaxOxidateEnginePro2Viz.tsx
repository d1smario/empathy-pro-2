"use client";

import type { MaxOxidateOutput } from "@/lib/engines/max-oxidate-engine";

type Seg = { key: string; label: string; value: number; tone: string };

function SegmentedBar({ segments, unit }: { segments: Seg[]; unit: string }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const denom = total > 0 ? total : 1;
  return (
    <div className="maxox-engine-viz-bar-wrap">
      <div
        className="maxox-engine-viz-bar-track"
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value.toFixed(2)} ${unit}`).join(", ")}
      >
        {segments.map((seg) => {
          const w = (Math.max(0, seg.value) / denom) * 100;
          if (w < 0.05) return null;
          return (
            <div
              key={seg.key}
              className={`maxox-engine-viz-bar-seg maxox-engine-viz-bar-seg--${seg.tone}`}
              style={{ width: `${w}%` }}
              title={`${seg.label}: ${seg.value.toFixed(2)} ${unit}`}
            />
          );
        })}
      </div>
      <ul className="maxox-engine-viz-legend">
        {segments.map((seg) => (
          <li key={seg.key}>
            <span className={`maxox-engine-viz-dot maxox-engine-viz-dot--${seg.tone}`} />
            <span className="maxox-engine-viz-legend-label">{seg.label}</span>
            <span className="maxox-engine-viz-legend-val">
              {seg.value.toFixed(2)} {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MeterRow({ label, value01, tone }: { label: string; value01: number; tone: string }) {
  const p = Math.min(100, Math.max(0, value01 * 100));
  return (
    <div className="maxox-engine-viz-meter">
      <div className="maxox-engine-viz-meter-head">
        <span>{label}</span>
        <span className="maxox-engine-viz-meter-pct">{p.toFixed(0)}%</span>
      </div>
      <div className="maxox-engine-viz-meter-track">
        <div className={`maxox-engine-viz-meter-fill maxox-engine-viz-meter-fill--${tone}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/** Vista grafica Pro2 per l’output Max Oxidate (capacità, substrati, delivery, stress). */
export function MaxOxidateEnginePro2Viz({ model }: { model: MaxOxidateOutput }) {
  const cap = Math.max(1e-6, model.oxidativeCapacityKcalMin);
  const reqOx = Math.max(0, model.oxidativeDemandKcalMin);
  const headroom = Math.max(0, cap - reqOx);
  const fluxSegs: Seg[] = [
    { key: "req", label: "Domanda ossidativa (≤CP)", value: reqOx, tone: "rose" },
    { key: "head", label: "Margine capacità", value: headroom, tone: "cyan" },
  ];

  const cho = Math.max(0, model.oxidativeCapacityChoGMin);
  const fat = Math.max(0, model.oxidativeCapacityFatGMin);
  const subSegs: Seg[] = [
    { key: "cho", label: "Flusso CHO ossidabile", value: cho, tone: "amber" },
    { key: "fat", label: "Flusso FAT ossidabile", value: fat, tone: "slate" },
  ];

  const cDel = Math.min(1, Math.max(0, model.centralDeliveryIndex / 1.2));
  const pUti = Math.min(1, Math.max(0, model.peripheralUtilizationIndex / 1.15));

  return (
    <div className="maxox-engine-viz">
      <div className="maxox-engine-viz-card">
        <h4 className="maxox-engine-viz-title">Capacità ossidativa vs domanda</h4>
        <p className="maxox-engine-viz-sub">
          Capacità <strong>{model.oxidativeCapacityKcalMin.toFixed(2)} kcal/min</strong> · saturazione ossidativa{" "}
          <strong>{model.utilizationRatioPct.toFixed(0)}%</strong> · domanda totale {model.requiredKcalMin.toFixed(2)} kcal/min
        </p>
        <SegmentedBar segments={fluxSegs} unit="kcal/min" />
      </div>

      <div className="maxox-engine-viz-card">
        <h4 className="maxox-engine-viz-title">Substrati · potenziale ossidativo (g/min)</h4>
        <p className="maxox-engine-viz-sub">Partizione stimata da intensità, RER e lattato (motore v1.2).</p>
        <SegmentedBar segments={subSegs} unit="g/min" />
      </div>

      <div className="maxox-engine-viz-card maxox-engine-viz-card--wide">
        <h4 className="maxox-engine-viz-title">Delivery centrale · utilizzo periferico · estrazione</h4>
        <div className="maxox-engine-viz-meter-grid">
          <MeterRow label="Indice delivery centrale (norm.)" value01={cDel} tone="cyan" />
          <MeterRow label="Indice utilizzo periferico (norm.)" value01={pUti} tone="rose" />
          <MeterRow label="Estrazione SmO₂" value01={model.extractionPct / 85} tone="violet" />
        </div>
        <p className="maxox-engine-viz-hint">
          VO₂ rel <strong>{model.vo2RelMlKgMin.toFixed(1)} ml/kg/min</strong> · potenza ossidativa {model.oxidativePowerKw.toFixed(3)} kW · stato:{" "}
          <span className="maxox-engine-viz-state">{model.state}</span>
        </p>
      </div>

      <div className="maxox-engine-viz-card maxox-engine-viz-card--wide">
        <h4 className="maxox-engine-viz-title">Stress ossidativo · redox · NADH</h4>
        <div className="maxox-engine-viz-meter-grid">
          <MeterRow label="Collo di bottiglia (indice)" value01={model.oxidativeBottleneckIndex / 100} tone="rose" />
          <MeterRow label="Stress redox" value01={model.redoxStressIndex / 100} tone="amber" />
          <MeterRow label="Pressione NADH" value01={model.nadhPressureIndex} tone="violet" />
        </div>
        <p className="maxox-engine-viz-hint">
          Riossidazione (indice) {(model.reoxidationCapacityIndex * 100).toFixed(0)}% · tipo limite dominante nel motore:{" "}
          <strong>{model.bottleneckType.replaceAll("_", " ")}</strong>
        </p>
      </div>
    </div>
  );
}
