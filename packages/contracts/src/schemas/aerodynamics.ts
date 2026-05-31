import type { IsoDateTime } from "./common";

export type AerodynamicsCaptureSource = "smartphone_video" | "gopro_video" | "image" | "manual_test" | "external_aero_import";

export type AerodynamicsCameraMode = "side" | "front" | "rear" | "multi_view" | "three_sixty";

export type AerodynamicsCaptureJobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export type AerodynamicsEquipmentSnapshot = {
  helmet?: string | null;
  wheels?: string | null;
  frame?: string | null;
  cockpit?: string | null;
  clothing?: string | null;
  bottles?: string[] | null;
};

export type AerodynamicsPositionSnapshot = {
  shoulderWidthMm?: number;
  elbowWidthMm?: number;
  headDropMm?: number;
  torsoAngleDeg?: number;
  armExtensionDeg?: number;
  dropMm?: number;
  reachMm?: number;
  confidence01?: number;
};

export type AerodynamicsGeometryProfile = {
  frontalAreaM2?: number;
  projectedAreaM2?: number;
  wettedAreaProxyM2?: number;
  bodyVolumeProxyL?: number;
  confidence01?: number;
};

export type AerodynamicsCdAEstimate = {
  cdaM2: number;
  speedKph?: number;
  dragWatts?: number;
  confidence01: number;
  method: "field_estimate" | "surrogate_model" | "manual_import" | "wind_tunnel_import";
};

export type AerodynamicsOptimizationResult = {
  baselineCdaM2: number;
  optimizedCdaM2: number;
  deltaCdaM2: number;
  wattSavingsAtReferenceSpeed: number;
  timeSavingsSecondsPerHour?: number;
  changedVariables: Array<keyof AerodynamicsPositionSnapshot>;
  confidence01: number;
};

export type AerodynamicsScores = {
  cdaScore01: number;
  positionScore01: number;
  equipmentScore01: number;
  aeroEfficiency01: number;
};

export type AerodynamicsPositionScenarioV1 = {
  id: string;
  label: string;
  position: AerodynamicsPositionSnapshot;
  equipment?: AerodynamicsEquipmentSnapshot;
  cdaM2: number;
  wattSavingsVsBaseline: number;
  changedVariables: Array<keyof AerodynamicsPositionSnapshot>;
  confidence01: number;
  method: "surrogate_model";
};

export type AerodynamicsScenarioCompareV1 = {
  version: "aero_scenario_compare_v1";
  referenceSpeedKph: number;
  baselineScenarioId: string;
  selectedScenarioId?: string;
  candidates: AerodynamicsPositionScenarioV1[];
};

export type AerodynamicsCaptureJobV1 = {
  id: string;
  athleteId: string;
  status: AerodynamicsCaptureJobStatus;
  source: AerodynamicsCaptureSource;
  cameraMode: AerodynamicsCameraMode;
  mediaStoragePath?: string;
  createdAt: IsoDateTime;
  updatedAt?: IsoDateTime;
  errorMessage?: string | null;
};

export type AerodynamicsTestSessionV1 = {
  id: string;
  athleteId: string;
  recordedAt: IsoDateTime;
  source: AerodynamicsCaptureSource;
  position: AerodynamicsPositionSnapshot;
  equipment: AerodynamicsEquipmentSnapshot;
  geometry?: AerodynamicsGeometryProfile;
  cdaEstimate: AerodynamicsCdAEstimate;
  optimization?: AerodynamicsOptimizationResult;
  scores?: AerodynamicsScores;
  payloadVersion: "aerodynamics_test_session_v1";
  payload?: Record<string, unknown>;
};

export type AerodynamicsTwinSnapshotV1 = {
  athleteId: string;
  computedAt: IsoDateTime;
  latestTestSessionId?: string;
  currentCdaM2?: number;
  optimizedCdaM2?: number;
  equipment: AerodynamicsEquipmentSnapshot;
  position: AerodynamicsPositionSnapshot;
  scores: AerodynamicsScores;
  confidence01: number;
  algorithmVersion: string;
};
