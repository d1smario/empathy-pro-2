"use client";

import type { ReactNode } from "react";
import { Activity, CheckCircle2 } from "lucide-react";
import type { MaxOxidateOutput } from "@/lib/engines/max-oxidate-engine";
import { MaxOxidateLabPro2Panel } from "@/components/physiology/MaxOxidateLabPro2Panel";
import { MaxOxPro2EngineReport } from "@/components/physiology/MaxOxPro2EngineReport";

export type PhysiologyPro2MaxOxLabProps = {
  model: MaxOxidateOutput;
  reliabilityPct: number;
  uncertaintyPct: number;
  bottleneckLabel: string;
  ratioSummary: string;
  redoxSummary: string;
  /** VO₂ capacità nel modello (curva CP / test / stima potenza). */
  vo2Used: number;
  vo2AtPowerL: number;
  vo2MlKgCapacity: number;
  vo2MlKgAtPower: number;
  vo2CapacitySource: "metabolic_engine_vo2max" | "power_estimate" | "test_manual";
  /** Per caption Max Oxidate: VO₂max da Metabolic Profile (curva CP), se disponibile. */
  vo2maxMlMinKgForCaption?: number | null;
  vo2maxLMinForCaption?: number | null;
  maxOxVo2Mode: "device" | "test";
  sessionCount: number;
  autoDecodeText: string | null;
  children: ReactNode;
};

export function PhysiologyPro2MaxOxLab({
  model,
  reliabilityPct,
  uncertaintyPct,
  bottleneckLabel,
  ratioSummary,
  redoxSummary,
  vo2Used,
  vo2AtPowerL,
  vo2MlKgCapacity,
  vo2MlKgAtPower,
  vo2CapacitySource,
  vo2maxMlMinKgForCaption,
  vo2maxLMinForCaption,
  maxOxVo2Mode,
  sessionCount,
  autoDecodeText,
  children,
}: PhysiologyPro2MaxOxLabProps) {
  return (
    <div className="physiology-pro2-lab physiology-pro2-lab--maxox">
      <div className="physiology-pro2-lab-hero">
        <p className="physiology-pro2-lab-kicker">Delivery centrale · utilizzo periferico · collo di bottiglia ossidativo</p>
        <h1 className="physiology-pro2-lab-title physiology-pro2-lab-title--rose">Max oxidate lab</h1>
        <p className="physiology-pro2-maxox-steady-note">
          Il motore lavora su <strong>un solo stato metabolico</strong>: una potenza, un VO₂, un RER, SmO₂ e lattato coerenti tra loro (quasi-stazionario). Selezionando una sessione intera, i campi si riempiono con i{" "}
          <strong>valori aggregati / snapshot</strong> che l’import espone oggi — non con un ritaglio lap-by-lap. Per una salita o un test a ritmo costante ha senso usare{" "}
          <strong>numeri di quel tratto</strong> (export dedicato o input manuale). Scatti e on/off alternati violano l’ipotesi: i numeri restano calcolabili ma la lettura fisiologica è debole.
        </p>
        {autoDecodeText ? (
          <div className="physiology-pro2-lab-decode physiology-pro2-lab-decode--rose">
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

      <MaxOxidateLabPro2Panel
        model={model}
        vo2maxMlMinKg={vo2maxMlMinKgForCaption ?? null}
        vo2maxLMin={vo2maxLMinForCaption ?? null}
        maxOxVo2UsedLMin={vo2Used}
        vo2CapacitySource={vo2CapacitySource}
      />

      <MaxOxPro2EngineReport
        model={model}
        reliabilityPct={reliabilityPct}
        uncertaintyPct={uncertaintyPct}
        bottleneckLabel={bottleneckLabel}
        ratioSummary={ratioSummary}
        redoxSummary={redoxSummary}
        vo2Used={vo2Used}
        vo2AtPowerL={vo2AtPowerL}
        vo2MlKgCapacity={vo2MlKgCapacity}
        vo2MlKgAtPower={vo2MlKgAtPower}
        vo2CapacitySource={vo2CapacitySource}
        maxOxVo2Mode={maxOxVo2Mode}
      />

      <div className="physiology-pro2-lab-banner physiology-pro2-lab-banner--maxox-inputs">
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
        <span>CONFIGURAZIONE · SEGNALI · PARAMETRI MOTORE</span>
        <Activity className="physiology-pro2-lab-banner-ico" aria-hidden />
      </div>

      <div className="physiology-pro2-lab-page-stack">{children}</div>
    </div>
  );
}
