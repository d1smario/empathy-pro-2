import type {
  AthleteTimeSeriesSampleRowV1,
  BioenergeticBiaLiteratureSummaryV1,
  BioenergeticChannelCurveResolutionV1,
  BioenergeticDayEvidenceConditionedLayerV1,
} from "@empathy/contracts";

/** Risposta `POST /api/bioenergetics/merge-hourly-curve` (merge numerico sotto governance server). */
export type BioenergeticHourlyCurveMergeResponseV1 = {
  mergeContractVersion: 1;
  channelId: "glucose" | "lactate";
  mergedHourly: (number | null)[];
  curveResolution: BioenergeticChannelCurveResolutionV1;
  appliedAiBlend: boolean;
  /** Eco dalla giornata assemblata (stesso `GET …/day`). */
  dayContractVersion?: number;
};

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
 * - `ai_from_inputs`: curva generata da LLM solo dagli input giornata assemblati (niente sim diurno v1 sulla striscia).
 */
export type BioenergeticMonitoringDataPlane =
  | "model_continuous"
  | "measured_stream"
  | "sparse_lab_hold"
  | "ai_from_inputs";

/** Un canale nello stesso paradigma UI: striscia 24 h, oggi modello o misura; domani stream device ove applicabile. */
/** Campione continuo (es. 055) per asse tempo nativo nella UI; non sostituisce `hourly` nei contratti downstream. */
export type BioenergeticMonitoringStreamPoint = {
  observedAt: string;
  value: number;
};

export type BioenergeticMonitoringChannel24 = {
  id: string;
  labelIt: string;
  unit: string;
  category: BioenergeticMetricTileCategory;
  /** Valore per ore 0–23 (timezone locale implicita nel report giorno). */
  hourly: (number | null)[];
  /** Se presente (stream misurato denso), la striscia UI usa questi punti su asse tempo reale invece della sola risoluzione oraria. */
  streamTrace?: BioenergeticMonitoringStreamPoint[];
  dataPlane: BioenergeticMonitoringDataPlane;
  /** Se true, il prodotto intende questo canale come candidato a sostituzione con stream device continuo. */
  replacesWithDeviceStream: boolean;
  /** Policy fusione motore vs AI (v1); merge numerico AI quando endpoint validato. */
  curveResolution?: BioenergeticChannelCurveResolutionV1;
};

/** Vista giornaliera unificata «monitoraggio continuo» (modello v1 → device quando disponibile). */
export type BioenergeticContinuousMonitoringDay = {
  layer: "model_continuous_v1" | "ai_from_inputs_v1";
  channels: BioenergeticMonitoringChannel24[];
};

/**
 * Metadati predittori sub-orari v1 (glucosio + lattato + insulin proxy da stimoli timeline), presenti quando la slice
 * attiva `buildSimulatedGluLacDiurnalSubHourly` (passo 5 min) in domain-bioenergetics.
 */
export type BioenergeticStimulusPredictorSubhourlyMetaV1 = {
  contractVersion: 1;
  stepMinutes: 5;
  glucose: {
    predictorContractVersion: number;
    sourcePrefix: string;
    literatureManifestEntryIds: readonly string[];
  };
  lactate: {
    predictorContractVersion: number;
    sourcePrefix: string;
    literatureManifestEntryIds: readonly string[];
  };
  insulin: {
    predictorContractVersion: number;
    sourcePrefix: string;
    literatureManifestEntryIds: readonly string[];
  };
};

/** Audit opzionale `GET …/bioenergetics/day?stripAudit=1` — input che alimentano le curve mostrate (verifica coerenza). */
export type BioenergeticMonitoringStripChannelAuditV1 = {
  id: string;
  labelIt: string;
  unit: string;
  dataPlane: BioenergeticMonitoringDataPlane;
  hourlyNonNullCount: number;
  hourlyMin: number | null;
  hourlyMax: number | null;
  streamPointCount: number;
  curveResolutionNote: string | null;
};

export type BioenergeticMonitoringStripAuditV1 = {
  auditContractVersion: 1;
  stripLayerRendered: BioenergeticContinuousMonitoringDay["layer"];
  kernel: BioenergeticDayKernelOutput;
  diaryAndTraining: {
    choIntakeGramsDay: number;
    executedWorkoutCount: number;
    plannedWorkoutCount: number;
    executedTssSum: number;
    plannedTssSum: number;
    diaryRowCount: number;
    mealsWithMacroSignals: number;
  };
  channelsSource: {
    glucosePointCount: number;
    lactatePointCount: number;
    glucoseProvenance: BioenergeticChannelProvenance;
    lactateProvenance: BioenergeticChannelProvenance;
    glucoseSamples055: number;
    lactateSamples055: number;
  };
  timelineDigest: {
    mealGlycemicMaxHour: number;
    mealGlycemicMaxWeight: number;
    activitySupportHours: number[];
    events: Array<{ ts: string; type: string; title: string }>;
  };
  cortisolActhModulation: {
    postprandialMealLoad01: number;
    noteIt: string;
  };
  engineRefsIt: string[];
  stripChannels: BioenergeticMonitoringStripChannelAuditV1[];
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

/** Scheletro rete metabolico-endocrina (v1): archi + osservabilità nodi da memoria giorno; si amplia nel tempo. */
export type BioenergeticInteractionSkeletonVmV1 = {
  contractVersion: 1;
  northStarIt: string;
  edges: ReadonlyArray<{
    from: string;
    to: string;
    mechanismIt: string;
    requires: readonly string[];
  }>;
  longestInterMealGapHoursEstimate: number | null;
  nodes: ReadonlyArray<{
    nodeId: string;
    labelIt: string;
    observability: "high" | "partial" | "blocked";
    rationaleIt: string;
  }>;
};

export type BioenergeticsDayViewModel = {
  /** Versione contratto `GET …/bioenergetics/day`: incrementare solo con breaking change lato client. */
  dayContractVersion: 1;
  /**
   * Conteggi campioni `athlete_time_series_samples` (055) nella slice giorno (stessa query della memoria;
   * audit «stream canonico» senza parametri query aggiuntivi).
   */
  canonicalStreamCounts: {
    glucoseSampleCount: number;
    lactateSampleCount: number;
  };
  athleteId: string;
  date: string;
  range: { from: string; to: string };
  timeline: BioenergeticTimelineEvent[];
  channels: {
    glucose: BioenergeticSeriesPoint[] | null;
    lactate: BioenergeticSeriesPoint[] | null;
    /** Predittore insulinico 5 min (stesso bundle `buildSimulatedGluLacDiurnalSubHourly`); assente senza sim sub-oraria. */
    insulinProxyDense?: BioenergeticSeriesPoint[] | null;
  };
  provenance: {
    glucose: BioenergeticChannelProvenance;
    lactate: BioenergeticChannelProvenance;
  };
  kernel: BioenergeticDayKernelOutput;
  /** Banca coefficienti simulatore diurno / tile lab (domain-bioenergetics), se valorizzato. */
  simBankVersion?: number;
  /**
   * Predittori glucosio/lattato/insulin proxy a passo 5 min (stimoli timeline + kernel);
   * assente quando non viene costruita la sim sub-oraria condivisa (es. entrambi i canali già misurati).
   */
  stimulusPredictorSubhourlyV1?: BioenergeticStimulusPredictorSubhourlyMetaV1;
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
  /** Rete interazioni metabolico-endocrine: scheletro v1 + buchi dati (es. ghrelina senza diario). */
  interactionSkeleton?: BioenergeticInteractionSkeletonVmV1 | null;
  /** Solo con `?stripAudit=1` sulla GET giornata: tabella tecnica input → curve. */
  monitoringStripAuditV1?: BioenergeticMonitoringStripAuditV1;
  /** Fusione striscia: predizione (meal plan + training pianificato) → adattamento (diario + eseguito). */
  planRealityFusionV1?: PlanRealityFusionMetaV1;
};

export type PlanRealityFusionMetaV1 = {
  contractVersion: 1;
  adaptFromHour: number;
  planSource: "nutrition_plans" | "calendar_training_solver" | "none";
  plannedMealCount: number;
  diaryMealCount: number;
  executedSessionCount: number;
  transitionHours: number;
};

/** `GET …/bioenergetics/window`: array di VM giornata (stesso contratto del singolo giorno per elemento). */
export type BioenergeticsWindowViewModel = {
  windowContractVersion: 1;
  dayContractVersion: 1;
  athleteId: string;
  from: string;
  to: string;
  days: BioenergeticsDayViewModel[];
};

/** `GET …/bioenergetics/streams`: campioni time-series (glucosio / lattato) su intervallo date. */
export type BioenergeticsTimeSeriesStreamResponseV1 = {
  streamContractVersion: 1;
  athleteId: string;
  from: string;
  to: string;
  channel: string;
  samples: AthleteTimeSeriesSampleRowV1[];
  truncated: boolean;
  skippedSchema?: boolean;
};
