export type BioenergeticChannelProvenance = "measured" | "estimated" | "absent" | "planned";

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
  /** Curve fisiologiche / stimoli (memoria giorno + device); array vuoto se nessuna serie. */
  series: BioenergeticDaySeriesChannel[];
};
