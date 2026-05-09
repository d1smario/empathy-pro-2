export type BioenergeticChannelProvenance = "measured" | "estimated" | "absent";

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
  interpretationHints: BioenergeticInterpretationHint[];
  disclaimers: string[];
};
