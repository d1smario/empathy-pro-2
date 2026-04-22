"use client";

import { Flame } from "lucide-react";
import type { MaxOxidateOutput } from "@/lib/engines/max-oxidate-engine";
import { MaxOxidateEnginePro2Viz } from "@/components/physiology/MaxOxidateEnginePro2Viz";

export type MaxOxidateLabPro2PanelProps = {
  model: MaxOxidateOutput;
  /** VO₂max ml/kg/min da profilo anagrafico/lab, se presente. */
  vo2maxMlMinKg?: number | null;
  /** VO₂max in L/min da Metabolic Profile, se presente. */
  vo2maxLMin?: number | null;
  /** VO₂ (L/min) effettivamente usato come capacità nel motore Max Oxidate. */
  maxOxVo2UsedLMin: number;
  vo2CapacitySource: "metabolic_engine_vo2max" | "power_estimate" | "test_manual";
};

/**
 * Shell Pro2 per il lab Max Oxidate: stessa gerarchia visiva del Lactate Lab (testata, caption, sintesi grafica, nota a piè).
 */
export function MaxOxidateLabPro2Panel({
  model,
  vo2maxMlMinKg,
  vo2maxLMin,
  maxOxVo2UsedLMin,
  vo2CapacitySource,
}: MaxOxidateLabPro2PanelProps) {
  const vo2Block =
    vo2CapacitySource === "test_manual" ? (
      <>
        Capacità VO₂: <strong>{maxOxVo2UsedLMin.toFixed(2)} L/min</strong> (test manuale).
      </>
    ) : vo2CapacitySource === "metabolic_engine_vo2max" ? (
      <>
        VO₂max da <strong>Metabolic Profile</strong> (modello CP):{" "}
        {vo2maxMlMinKg != null ? (
          <strong>
            {vo2maxMlMinKg.toFixed(1)} ml/kg/min · {maxOxVo2UsedLMin.toFixed(2)} L/min
          </strong>
        ) : (
          <strong>{maxOxVo2UsedLMin.toFixed(2)} L/min</strong>
        )}
        .
      </>
    ) : (
      <>
        Attenzione: capacità VO₂ solo da <strong>stima potenza</strong> ({maxOxVo2UsedLMin.toFixed(2)} L/min) — per un tetto
        credibile compila la <strong>curva CP</strong> in Metabolic profile (VO₂max motore).
      </>
    );

  return (
    <div className="physiology-pro2-maxox-card" aria-label="Max Oxidate lab Pro 2">
      <div className="physiology-pro2-maxox-head">
        <div className="physiology-pro2-maxox-head-left">
          <div className="physiology-pro2-maxox-head-title-row">
            <div className="physiology-pro2-maxox-ico" aria-hidden>
              <Flame size={20} strokeWidth={1.75} />
            </div>
            <h3 className="physiology-pro2-maxox-title">Max Oxidate Lab</h3>
          </div>
          <p className="physiology-pro2-maxox-caption">
            {vo2Block}{" "}
            Confronto tra <strong>capacità ossidativa netta</strong> (VO₂ × delivery) e{" "}
            <strong>domanda ossidativa min(P, CP)</strong> — non l’intera potenza meccanica. Indici di delivery e redox sono proxy deterministici.
          </p>
        </div>
        <div className="physiology-pro2-maxox-strip">
          Saturazione ossidativa{" "}
          <span className="physiology-pro2-maxox-strip-value">{model.utilizationRatioPct.toFixed(0)}%</span>
          <span className="physiology-pro2-maxox-strip-unit"> · collo </span>
          <span className="physiology-pro2-maxox-strip-value physiology-pro2-maxox-strip-value--pink">
            {model.oxidativeBottleneckIndex.toFixed(0)}
          </span>
          <span className="physiology-pro2-maxox-strip-unit">/100</span>
        </div>
      </div>

      <div className="physiology-pro2-maxox-viz-wrap">
        <MaxOxidateEnginePro2Viz model={model} />
      </div>

      <p className="physiology-pro2-maxox-footnote">
        Motore <strong>{model.version.replaceAll("-", " ")}</strong>. Per calibrazione clinica usare gas exchange e marker ematici; qui il focus è coerenza con CP/VO₂max e segnali sessione.
      </p>
    </div>
  );
}
