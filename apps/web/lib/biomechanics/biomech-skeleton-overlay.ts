import type { BiomechanicsJointAngleSample, BiomechanicsLandmark3D } from "@empathy/contracts";

import { deriveJointAnglesFromLandmarks } from "@/lib/biomechanics/biomech-landmark-angles";

/** Normalized frame coords 0–1000 (x right, y down). CV sidecar uses the same space until metric calibration. */
export const GOLDEN_SAGITTAL_LANDMARKS: BiomechanicsLandmark3D[] = [
  { name: "head", xMm: 520, yMm: 68, confidence01: 0.92 },
  { name: "neck", xMm: 515, yMm: 128, confidence01: 0.91 },
  { name: "shoulder", xMm: 488, yMm: 188, confidence01: 0.9 },
  { name: "elbow", xMm: 428, yMm: 278, confidence01: 0.86 },
  { name: "wrist", xMm: 398, yMm: 348, confidence01: 0.82 },
  { name: "hip", xMm: 468, yMm: 308, confidence01: 0.91 },
  { name: "knee_l", xMm: 418, yMm: 468, confidence01: 0.9 },
  { name: "ankle_l", xMm: 448, yMm: 608, confidence01: 0.88 },
  { name: "foot_l", xMm: 488, yMm: 668, confidence01: 0.85 },
  { name: "knee_r", xMm: 438, yMm: 458, confidence01: 0.72 },
  { name: "ankle_r", xMm: 462, yMm: 598, confidence01: 0.68 },
  { name: "foot_r", xMm: 498, yMm: 656, confidence01: 0.65 },
];

export const SKELETON_EDGES: ReadonlyArray<[string, string]> = [
  ["head", "neck"],
  ["neck", "shoulder"],
  ["shoulder", "elbow"],
  ["elbow", "wrist"],
  ["shoulder", "hip"],
  ["hip", "knee_l"],
  ["knee_l", "ankle_l"],
  ["ankle_l", "foot_l"],
  ["hip", "knee_r"],
  ["knee_r", "ankle_r"],
  ["ankle_r", "foot_r"],
];

export type JointAngleTriple = {
  joint: BiomechanicsJointAngleSample["joint"];
  side?: BiomechanicsJointAngleSample["side"];
  a: string;
  b: string;
  c: string;
  color: string;
};

export const JOINT_ANGLE_TRIPLES: JointAngleTriple[] = [
  { joint: "hip", side: "left", a: "shoulder", b: "hip", c: "knee_l", color: "#e879f9" },
  { joint: "knee", side: "left", a: "hip", b: "knee_l", c: "ankle_l", color: "#22d3ee" },
  { joint: "ankle", side: "left", a: "knee_l", b: "ankle_l", c: "foot_l", color: "#fb923c" },
  { joint: "hip", side: "right", a: "shoulder", b: "hip", c: "knee_r", color: "#c084fc" },
  { joint: "knee", side: "right", a: "hip", b: "knee_r", c: "ankle_r", color: "#67e8f9" },
  { joint: "ankle", side: "right", a: "knee_r", b: "ankle_r", c: "foot_r", color: "#fdba74" },
];

export type Point2D = { x: number; y: number };

export function landmarkIndex(landmarks: readonly BiomechanicsLandmark3D[]): Map<string, BiomechanicsLandmark3D> {
  return new Map(landmarks.map((row) => [row.name, row]));
}

export function resolveOverlayLandmarks(landmarks: readonly BiomechanicsLandmark3D[] | undefined): BiomechanicsLandmark3D[] {
  if (landmarks?.length) return [...landmarks];
  return [...GOLDEN_SAGITTAL_LANDMARKS];
}

export function scaleLandmarkToCanvas(
  landmark: BiomechanicsLandmark3D,
  width: number,
  height: number,
): Point2D {
  return {
    x: (landmark.xMm / 1000) * width,
    y: (landmark.yMm / 1000) * height,
  };
}

export function angleBetweenPoints(a: Point2D, b: Point2D, c: Point2D): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBa = Math.hypot(ba.x, ba.y);
  const magBc = Math.hypot(bc.x, bc.y);
  if (!magBa || !magBc) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (magBa * magBc)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function jointKey(joint: BiomechanicsJointAngleSample["joint"], side?: BiomechanicsJointAngleSample["side"]): string {
  return `${joint}:${side ?? "midline"}`;
}

export function pickJointAnglesForPhase(
  samples: readonly BiomechanicsJointAngleSample[],
  phasePct: number,
): BiomechanicsJointAngleSample[] {
  const withPhase = samples.filter((row) => typeof row.phasePct === "number");
  if (!withPhase.length) return [...samples];

  const phases = [...new Set(withPhase.map((row) => row.phasePct!))].sort((a, b) => a - b);
  const target = phases.reduce((best, current) =>
    Math.abs(current - phasePct) < Math.abs(best - phasePct) ? current : best,
  );
  const picked = withPhase.filter((row) => row.phasePct === target);
  const keys = new Set(picked.map((row) => jointKey(row.joint, row.side)));
  const fallback = samples.filter((row) => typeof row.phasePct !== "number" && !keys.has(jointKey(row.joint, row.side)));
  return [...picked, ...fallback] as BiomechanicsJointAngleSample[];
}

export function listAvailablePhases(samples: readonly BiomechanicsJointAngleSample[]): number[] {
  const phases = samples
    .map((row) => row.phasePct)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return phases.length ? [...new Set(phases)].sort((a, b) => a - b) : [50];
}

export function findJointAngleDeg(
  samples: readonly BiomechanicsJointAngleSample[],
  joint: BiomechanicsJointAngleSample["joint"],
  side?: BiomechanicsJointAngleSample["side"],
): number | null {
  const match =
    samples.find((row) => row.joint === joint && row.side === side) ??
    samples.find((row) => row.joint === joint && !row.side);
  return match && Number.isFinite(match.angleDeg) ? match.angleDeg : null;
}

function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  a: Point2D,
  b: Point2D,
  c: Point2D,
  color: string,
): void {
  const angleA = Math.atan2(a.y - b.y, a.x - b.x);
  const angleC = Math.atan2(c.y - b.y, c.x - b.x);
  let start = angleA;
  let end = angleC;
  let delta = end - start;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  if (Math.abs(delta) < 0.05) return;

  const radius = Math.min(42, Math.hypot(a.x - b.x, a.y - b.y) * 0.35, Math.hypot(c.x - b.x, c.y - b.y) * 0.35);
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.95;
  ctx.arc(b.x, b.y, radius, start, start + delta, delta < 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawLabelBadge(ctx: CanvasRenderingContext2D, point: Point2D, text: string, color: string): void {
  ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
  const paddingX = 8;
  const paddingY = 5;
  const metrics = ctx.measureText(text);
  const w = metrics.width + paddingX * 2;
  const h = 22;
  const x = point.x + 10;
  const y = point.y - h - 8;

  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x + paddingX, y + h - paddingY - 2);
}

export type DrawSkeletonOverlayInput = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  landmarks: readonly BiomechanicsLandmark3D[];
  jointAngles: readonly BiomechanicsJointAngleSample[];
  phasePct?: number;
  /** Evidenzia il landmark in trascinamento. */
  activeLandmark?: string | null;
};

export function drawBiomechSkeletonOverlay(input: DrawSkeletonOverlayInput): void {
  const { ctx, width, height } = input;
  if (width < 8 || height < 8) return;

  ctx.clearRect(0, 0, width, height);

  const phase = typeof input.phasePct === "number" ? input.phasePct : 50;
  const resolvedLandmarks = resolveOverlayLandmarks(input.landmarks);
  const geometryAngles = deriveJointAnglesFromLandmarks(resolvedLandmarks, input.jointAngles);
  const angles = pickJointAnglesForPhase(geometryAngles.length ? geometryAngles : input.jointAngles, phase);
  const index = landmarkIndex(resolvedLandmarks);
  const point = (name: string): Point2D | null => {
    const row = index.get(name);
    return row ? scaleLandmarkToCanvas(row, width, height) : null;
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [from, to] of SKELETON_EDGES) {
    const a = point(from);
    const b = point(to);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(167, 139, 250, 0.95)";
    ctx.lineWidth = 4;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  for (const row of index.values()) {
    const p = scaleLandmarkToCanvas(row, width, height);
    const active = input.activeLandmark === row.name;
    ctx.beginPath();
    ctx.fillStyle = active ? "rgba(251, 191, 36, 0.98)" : "rgba(236, 72, 153, 0.95)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = active ? 3 : 2;
    ctx.arc(p.x, p.y, active ? 9 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  for (const triple of JOINT_ANGLE_TRIPLES) {
    const a = point(triple.a);
    const b = point(triple.b);
    const c = point(triple.c);
    if (!a || !b || !c) continue;

    const reported = findJointAngleDeg(angles, triple.joint, triple.side);
    if (reported == null) continue;

    drawAngleArc(ctx, a, b, c, triple.color);
    const label = `${Math.round(reported)}°`;
    drawLabelBadge(ctx, b, label, triple.color);
  }
}
