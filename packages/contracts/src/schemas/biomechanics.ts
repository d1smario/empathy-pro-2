import type { IsoDateTime } from "./common";

export type BiomechanicsDiscipline = "cycling" | "running" | "walking" | "gym" | "movement_screening";

export type BiomechanicsCaptureSource = "smartphone_video" | "gopro_video" | "image" | "manual_import" | "external_pose_import";

export type BiomechanicsCameraPlane = "front" | "side" | "rear" | "oblique" | "multi_view";

export type BiomechanicsCaptureJobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

export type BiomechanicsScaleCalibration = {
  method: "athlete_height" | "wheel_diameter" | "saddle_height" | "frame_component" | "manual_reference";
  referenceLabel: string;
  referenceValueMm: number;
  confidence01?: number;
};

export type BiomechanicsLandmark3D = {
  name: string;
  xMm: number;
  yMm: number;
  zMm?: number;
  confidence01?: number;
};

export type BiomechanicsJointAngleSample = {
  joint: "hip" | "knee" | "ankle" | "shoulder" | "elbow" | "back" | "neck";
  side?: "left" | "right" | "midline";
  angleDeg: number;
  phasePct?: number;
  confidence01?: number;
};

export type BiomechanicsSegmentLengths = {
  femurMm?: number;
  tibiaMm?: number;
  torsoMm?: number;
  humerusMm?: number;
  forearmMm?: number;
  confidence01?: number;
};

export type BiomechanicsMovementPatternSummary = {
  pelvicStability01?: number;
  kneeTracking01?: number;
  ankleDynamics01?: number;
  strideSymmetry01?: number;
  rangeOfMotion01?: number;
  compensationFlags?: string[];
};

export type BiomechanicsRiskScores = {
  kneeRisk01?: number;
  hipRisk01?: number;
  lumbarRisk01?: number;
  achillesRisk01?: number;
  cervicalRisk01?: number;
};

export type BiomechanicsEfficiencyScores = {
  biomechanicalEfficiency01: number;
  movementQuality01: number;
  symmetry01: number;
  injuryRisk01: number;
};

export type BiomechanicsCaptureJobV1 = {
  id: string;
  athleteId: string;
  status: BiomechanicsCaptureJobStatus;
  source: BiomechanicsCaptureSource;
  discipline: BiomechanicsDiscipline;
  cameraPlane: BiomechanicsCameraPlane;
  mediaStoragePath?: string;
  createdAt: IsoDateTime;
  updatedAt?: IsoDateTime;
  errorMessage?: string | null;
};

export type BiomechanicsSessionImportV1 = {
  id: string;
  athleteId: string;
  recordedAt: IsoDateTime;
  source: BiomechanicsCaptureSource;
  discipline: BiomechanicsDiscipline;
  calibration?: BiomechanicsScaleCalibration;
  landmarks?: BiomechanicsLandmark3D[];
  jointAngles?: BiomechanicsJointAngleSample[];
  anthropometrics?: BiomechanicsSegmentLengths;
  movementPatterns?: BiomechanicsMovementPatternSummary;
  riskScores?: BiomechanicsRiskScores;
  efficiencyScores?: BiomechanicsEfficiencyScores;
  payloadVersion: "biomechanics_session_import_v1";
  payload?: Record<string, unknown>;
};

export type BiomechanicsTwinSnapshotV1 = {
  athleteId: string;
  computedAt: IsoDateTime;
  latestSessionImportId?: string;
  disciplineCoverage: BiomechanicsDiscipline[];
  anthropometrics?: BiomechanicsSegmentLengths;
  movementPatterns?: BiomechanicsMovementPatternSummary;
  riskScores: BiomechanicsRiskScores;
  efficiencyScores: BiomechanicsEfficiencyScores;
  correctiveActionTags: string[];
  confidence01: number;
  algorithmVersion: string;
};
