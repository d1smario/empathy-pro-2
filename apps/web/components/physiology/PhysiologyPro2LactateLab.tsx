"use client";

import type { ReactNode } from "react";
import { Activity, CheckCircle2, Droplets, Gauge, HeartPulse } from "lucide-react";
import type { LactateEngineOutput } from "@/lib/engines/lactate-engine";
import { LactateEnginePro2Viz } from "@/components/physiology/LactateEnginePro2Viz";
import { LactatePro2EngineReport } from "@/components/physiology/LactatePro2EngineReport";
import { LactateThresholdPro2Panel } from "@/components/physiology/LactateThresholdPro2Panel";

export type PhysiologyPro2LactateLabProps = {
  model: LactateEngineOutput;
  reliabilityPct: number;
  uncertaintyPct: number;
  vo2Used: number;
  vo2EstL: number;
  vo2MlKg: number;
  rerUsed: number;
  choGap: number;
  fuelingHint: string;
  lactateHint: string;
  sessionCount: number;
  autoDecodeText: string | null;
  ftpW: number;
  lt1W: number;
  lt2W: number;
  vlamax: number;
  /** VO₂max da Metabolic Profile (CP) — preferito come riferimento massimo in UI curva lattato. */
  profileVo2maxMlMinKg?: number | null;
  intensityPctFtp: number;
  children: ReactNode;
};

export function PhysiologyPro2LactateLab({
  model,
  reliabilityPct,
  uncertaintyPct,
  vo2Used,
  vo2EstL,
  vo2MlKg,
  rerUsed,
  choGap,
  fuelingHint,
  lactateHint,
  sessionCount,
  autoDecodeText,
  ftpW,
  lt1W,
  lt2W,
  vlamax,
  profileVo2maxMlMinKg,
  intensityPctFtp,
  children,
}: PhysiologyPro2LactateLabProps) {
  const vo2maxRefMlMinKg = Math.max(0, profileVo2maxMlMinKg ?? 0, vo2MlKg ?? 0);
  return (
    <div className="physiology-pro2-lab physiology-pro2-lab--lactate">
      <div className="physiology-pro2-lab-hero">
        <p className="physiology-pro2-lab-kicker">Analisi metabolica dettagliata · lactate shuttle · motore CHO</p>
        <h1 className="physiology-pro2-lab-title physiology-pro2-lab-title--amber">Lactate &amp; oxidate analysis</h1>
        {autoDecodeText ? (
          <div className="physiology-pro2-lab-decode physiology-pro2-lab-decode--amber">
            <CheckCircle2 className="physiology-pro2-lab-decode-ico" aria-hidden />
            <div>
              <strong>Auto-decode attivo</strong>
              <span>{autoDecodeText}</span>
            </div>
            <span className="physiology-pro2-lab-sessions">
              <strong>{sessionCount}</strong> sessioni analizzate
            </span>
          </div>
        ) : null}
      </div>

      <LactatePro2EngineReport model={model} vo2Used={vo2Used} rerUsed={rerUsed} />

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-overview">
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>Bilanci compatti · barre (motore {model.version})</span>
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>
      <LactateEnginePro2Viz model={model} choGapG={choGap} />

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-overview">
        <Gauge className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>Qualità modello · gap · soglie</span>
        <Gauge className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-metric-row physiology-pro2-lab-metric-row--3">
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--lac">
          <Droplets className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">Lattato accumulato</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--lac-acc">{model.lactateAccumG.toFixed(1)} g</div>
        </div>
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--lac">
          <HeartPulse className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">CHO gap</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--cho-gap">{choGap.toFixed(0)} g</div>
        </div>
        <div className="physiology-pro2-lab-metric physiology-pro2-lab-metric--lac">
          <CheckCircle2 className="physiology-pro2-lab-metric-ico" aria-hidden />
          <div className="physiology-pro2-lab-metric-label">Affidabilità modello</div>
          <div className="physiology-pro2-lab-metric-value physiology-pro2-lab-metric-value--green">{reliabilityPct}/100</div>
          <div className="physiology-pro2-lab-metric-sub">±{uncertaintyPct}% incertezza input</div>
        </div>
      </div>

      <div className="physiology-pro2-lab-hint-strip">
        <span><strong>Fueling:</strong> {fuelingHint}</span>
        <span><strong>Lattato:</strong> {lactateHint}</span>
      </div>

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-curve">
        <Droplets className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>LACTATE THRESHOLD · CURVA vs %FTP</span>
        <Droplets className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-chart-card physiology-pro2-lab-chart-card--lactate">
        <LactateThresholdPro2Panel
          ftpW={Math.max(1, ftpW)}
          lt1W={lt1W}
          lt2W={lt2W}
          vlamax={vlamax}
          vo2maxMlMinKg={vo2maxRefMlMinKg >= 30 ? vo2maxRefMlMinKg : null}
          currentIntensityPctFtp={intensityPctFtp}
        />
      </div>

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--lactate-inputs">
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>CONFIGURAZIONE · SEGNALI · OUTPUT MOTORE</span>
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-page-stack">{children}</div>
    </div>
  );
}
