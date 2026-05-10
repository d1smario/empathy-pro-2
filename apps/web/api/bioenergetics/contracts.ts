import type {
  BioenergeticBiaLiteratureSummaryV1,
  BioenergeticChannelCurveResolutionV1,
  BioenergeticDayEvidenceConditionedLayerV1,
} from "@empathy/contracts";

export type BioenergeticChannelProvenance = "measured" | "estimated" | "absent" | "planned";

export type {
  BioenergeticBiaLiteratureSummaryV1,
  BioenergeticChannelCurveResolutionV1,
  BioenergeticDayEvidenceConditionedLayerV1,
};

export type BioenergeticSeriesPoint = {
  ts: string;
  value: number;
  source: string;
};

export type BioenergeticTimelineEvent = {
  id: string;
  ts: string;
  type: "planned_session" | "executed_session" | "meal" | "device_export" | "lab_marker";
  title: string;
  payload?: Record<string, unknown>;
};

export type BioenergeticDayKernelOutput = {
  modelVersion: number;
  glucoseHandlingScore: number;
  insulinDemandScore: number;
  oxidationDriveScore: number;
  anabolicSuppressionScore: number;
  efficiencyBand: "low" | "moderate" | "high";
  pathwayState: "supportive" | "mixed" | "inhibitory";
  keyDrivers: string[];
};

export type BioenergeticInterpretationHint = {
  pathwayId: string;
  level: "hormonal" | "metabolic" | "microbiota" | "autonomic";
  title: string;
  detail: string;
};

/** Effetto euristico sulla via metabolica modellata (non giudizio clinico). */
export type BioenergeticPathwayImpact = "supportive" | "neutral" | "inhibitory";

export type BioenergeticMetricTileCategory =
  | "metabolic"
  | "inflammatory"
  | "hormonal"
  | "neural"
  | "gastro_intestinal"
  | "gonadal";

export type BioenergeticMetricTile = {
  id: string;
  labelIt: string;
  unit: string;
  displayValue: string;
  numericValue: number | null;
  provenance: BioenergeticChannelProvenance;
  impact: BioenergeticPathwayImpact;
  category: BioenergeticMetricTileCategory;
};

export type BioenergeticHour24Point = {
  hour: number;
  hourLabel: string;
  pathwayBalance: number;
  pathwayImpact: BioenergeticPathwayImpact;
  glucoseMmol: number | null;
  /** Lattato ematico (mmol/L) interpolato sulla giornata da CGM/lab/sim diurna; stesso asse temporale del glucosio. */
  lactateMmol: number | null;
};

/**
 * Piano dati dello strato «monitoraggio continuo»:
 * - `model_continuous`: oggi da modello deterministico (sostituibile da stream).
 * - `measured_stream`: serie ad alta frequenza (es. CGM) sul giorno.
 * - `sparse_lab_hold`: singolo referto — valore tenuto costante fino a nuovi campioni/device.
 */
export type BioenergeticMonitoringDataPlane = "model_continuous" | "measured_stream" | "sparse_lab_hold";

/** Un canale nello stesso paradigma UI: striscia 24 h, oggi modello o misura; domani stream device ove applicabile. */
export type BioenergeticMonitoringChannel24 = {
  id: string;
  labelIt: string;
  unit: string;
  category: BioenergeticMetricTileCategory;
  /** Valore per ore 0–23 (timezone locale implicita nel report giorno). */
  hourly: (number | null)[];
  dataPlane: BioenergeticMonitoringDataPlane;
  /** Se true, il prodotto intende questo canale come candidato a sostituzione con stream device continuo. */
  replacesWithDeviceStream: boolean;
  /** Policy fusione motore vs AI (v1); merge numerico AI quando endpoint validato. */
  curveResolution?: BioenergeticChannelCurveResolutionV1;
};

/** Vista giornaliera unificata «monitoraggio continuo» (modello v1 → device quando disponibile). */
export type BioenergeticContinuousMonitoringDay = {
  layer: "model_continuous_v1";
  channels: BioenergeticMonitoringChannel24[];
};

/** Serie temporale giornaliera per curve UI (timestamp ISO + valore numerico). */
export type BioenergeticDaySeriesChannel = {
  id: string;
  labelIt: string;
  unit: string;
  points: BioenergeticSeriesPoint[];
  provenance: BioenergeticChannelProvenance;
  /** Origine logica per debug (es. device_sync_exports, executed_workouts). */
  sourceHint?: string;
};

export type BioenergeticsDayViewModel = {
  athleteId: string;
  date: string;
  range: { from: string; to: string };
  timeline: BioenergeticTimelineEvent[];
  channels: {
    glucose: BioenergeticSeriesPoint[] | null;
    lactate: BioenergeticSeriesPoint[] | null;
  };
  provenance: {
    glucose: BioenergeticChannelProvenance;
    lactate: BioenergeticChannelProvenance;
  };
  kernel: BioenergeticDayKernelOutput;
  /** Banca coefficienti simulatore diurno / tile lab (domain-bioenergetics), se valorizzato. */
  simBankVersion?: number;
  interpretationHints: BioenergeticInterpretationHint[];
  disclaimers: string[];
  metricTiles: BioenergeticMetricTile[];
  chart24h: BioenergeticHour24Point[];
  /** Striscia 24 h per ogni analita valorizzata: oggi modello/sparse/stream; stesso contratto quando arriveranno device. */
  continuousMonitoring?: BioenergeticContinuousMonitoringDay;
  /** Curve fisiologiche / stimoli (memoria giorno + device); array vuoto se nessuna serie. */
  series: BioenergeticDaySeriesChannel[];
  /**
   * Scenario letteratura + contesto (prior condizionate). `null` finché il synthesizer non è attivo.
   * Tipi canonici: `@empathy/contracts` (`BioenergeticDayEvidenceConditionedLayerV1`).
   */
  evidenceConditionedLayer: BioenergeticDayEvidenceConditionedLayerV1 | null;
  /** Modello deterministico BIA↔letteratura (v1); assente senza snapshot BIA. */
  biaLiteratureSummary?: BioenergeticBiaLiteratureSummaryV1 | null;
};
