import type { BiomechanicsJointAngleSample, BiomechanicsLandmark3D } from "@empathy/contracts";

import type { BiomechanicsCaptureViewMode } from "@/lib/biomechanics/biomech-capture-view";

/**
 * Landmark su piano immagine (xMm/yMm = 0–1000, asse X destra / Y giù).
 * Non è pose 3D: una sola catena arto visibile in presa laterale.
 */
export const MONOLATERAL_LANDMARK_IDS = [
  "head",
  "neck",
  "shoulder",
  "elbow",
  "wrist",
  "hip",
  "knee",
  "ankle",
  "foot",
] as const;

export type MonolateralLandmarkId = (typeof MONOLATERAL_LANDMARK_IDS)[number];

export const LANDMARK_LABEL_IT: Record<string, string> = {
  head: "Testa",
  neck: "Collo",
  shoulder: "Spalla",
  elbow: "Gomito",
  wrist: "Polso",
  hip: "Anca",
  knee: "Ginocchio",
  ankle: "Caviglia",
  foot: "Piede",
  knee_l: "Ginocchio",
  ankle_l: "Caviglia",
  foot_l: "Piede",
  knee_r: "Ginocchio (dx)",
  ankle_r: "Caviglia (dx)",
  foot_r: "Piede (dx)",
};

/** Golden fixture — solo catena sinistra visibile in laterale. */
export const GOLDEN_MONOLATERAL_SIDE_LANDMARKS: BiomechanicsLandmark3D[] = [
  { name: "head", xMm: 518, yMm: 72, confidence01: 0.92 },
  { name: "neck", xMm: 512, yMm: 132, confidence01: 0.91 },
  { name: "shoulder", xMm: 476, yMm: 192, confidence01: 0.9 },
  { name: "elbow", xMm: 408, yMm: 282, confidence01: 0.86 },
  { name: "wrist", xMm: 372, yMm: 352, confidence01: 0.82 },
  { name: "hip", xMm: 458, yMm: 318, confidence01: 0.91 },
  { name: "knee", xMm: 428, yMm: 478, confidence01: 0.9 },
  { name: "ankle", xMm: 442, yMm: 618, confidence01: 0.88 },
  { name: "foot", xMm: 468, yMm: 678, confidence01: 0.85 },
];

/** @deprecated Usare GOLDEN_MONOLATERAL_SIDE_LANDMARKS */
export const GOLDEN_SAGITTAL_LANDMARKS = GOLDEN_MONOLATERAL_SIDE_LANDMARKS;

const LEGACY_LANDMARK_MAP: Record<string, MonolateralLandmarkId | null> = {
  head: "head",
  neck: "neck",
  shoulder: "shoulder",
  elbow: "elbow",
  wrist: "wrist",
  hip: "hip",
  knee: "knee",
  ankle: "ankle",
  foot: "foot",
  knee_l: "knee",
  ankle_l: "ankle",
  foot_l: "foot",
  knee_r: null,
  ankle_r: null,
  foot_r: null,
};

export const MONOLATERAL_SKELETON_EDGES: ReadonlyArray<[MonolateralLandmarkId, MonolateralLandmarkId]> = [
  ["head", "neck"],
  ["neck", "shoulder"],
  ["shoulder", "elbow"],
  ["elbow", "wrist"],
  ["shoulder", "hip"],
  ["hip", "knee"],
  ["knee", "ankle"],
  ["ankle", "foot"],
];

export type JointAngleTriple = {
  joint: BiomechanicsJointAngleSample["joint"];
  side?: BiomechanicsJointAngleSample["side"];
  a: MonolateralLandmarkId;
  b: MonolateralLandmarkId;
  c: MonolateralLandmarkId;
  color: string;
};

/** Angoli sul lato visibile in presa laterale (monolaterale). */
export const MONOLATERAL_ANGLE_TRIPLES: JointAngleTriple[] = [
  { joint: "hip", side: "left", a: "shoulder", b: "hip", c: "knee", color: "#e879f9" },
  { joint: "knee", side: "left", a: "hip", b: "knee", c: "ankle", color: "#22d3ee" },
  { joint: "ankle", side: "left", a: "knee", b: "ankle", c: "foot", color: "#fb923c" },
];

/** @deprecated Bilaterale — solo per compatibilità import; overlay usa monolaterale. */
export const JOINT_ANGLE_TRIPLES = MONOLATERAL_ANGLE_TRIPLES;

export const SKELETON_EDGES = MONOLATERAL_SKELETON_EDGES;

export type Point2D = { x: number; y: number };

export function landmarkLabelIt(name: string): string {
  return LANDMARK_LABEL_IT[name] ?? name;
}

export function normalizeMonolateralLandmarks(landmarks: readonly BiomechanicsLandmark3D[]): BiomechanicsLandmark3D[] {
  const golden = landmarkIndex(GOLDEN_MONOLATERAL_SIDE_LANDMARKS);
  const merged = new Map<MonolateralLandmarkId, BiomechanicsLandmark3D>();

  for (const row of landmarks) {
    const mapped = LEGACY_LANDMARK_MAP[row.name];
    if (mapped === null) continue;
    const canon = mapped ?? (MONOLATERAL_LANDMARK_IDS.includes(row.name as MonolateralLandmarkId) ? row.name : null);
    if (!canon) continue;
    const id = canon as MonolateralLandmarkId;
    const prev = merged.get(id);
    const prefer =
      !prev ||
      row.name === id ||
      (row.name.endsWith("_l") && !prev.name.endsWith("_l"));
    if (prefer) {
      merged.set(id, { ...row, name: id });
    }
  }

  return MONOLATERAL_LANDMARK_IDS.map((id) => merged.get(id) ?? golden.get(id)!);
}

export function landmarkIndex(landmarks: readonly BiomechanicsLandmark3D[]): Map<string, BiomechanicsLandmark3D> {
  return new Map(landmarks.map((row) => [row.name, row]));
}

export function resolveOverlayLandmarks(
  landmarks: readonly BiomechanicsLandmark3D[] | undefined,
  viewMode: BiomechanicsCaptureViewMode = "monolateral_side",
): BiomechanicsLandmark3D[] {
  if (viewMode === "multiview") {
    return normalizeMonolateralLandmarks(landmarks?.length ? landmarks : GOLDEN_MONOLATERAL_SIDE_LANDMARKS);
  }
  if (!landmarks?.length) return [...GOLDEN_MONOLATERAL_SIDE_LANDMARKS];
  return normalizeMonolateralLandmarks(landmarks);
}

export function getAngleTriplesForView(viewMode: BiomechanicsCaptureViewMode): JointAngleTriple[] {
  if (viewMode === "multiview") return MONOLATERAL_ANGLE_TRIPLES;
  return MONOLATERAL_ANGLE_TRIPLES;
}

export function getSkeletonEdgesForView(viewMode: BiomechanicsCaptureViewMode): ReadonlyArray<[string, string]> {
  if (viewMode === "multiview") return MONOLATERAL_SKELETON_EDGES;
  return MONOLATERAL_SKELETON_EDGES;
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

function drawAngleBadge(ctx: CanvasRenderingContext2D, point: Point2D, text: string, color: string): void {
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

function drawLandmarkNameLabel(
  ctx: CanvasRenderingContext2D,
  point: Point2D,
  label: string,
  active: boolean,
): void {
  ctx.font = active ? "700 11px ui-sans-serif, system-ui, sans-serif" : "600 11px ui-sans-serif, system-ui, sans-serif";
  const paddingX = 6;
  const h = 18;
  const w = ctx.measureText(label).width + paddingX * 2;
  const x = point.x - w / 2;
  const y = point.y + 12;

  ctx.fillStyle = active ? "rgba(251, 191, 36, 0.92)" : "rgba(15, 15, 20, 0.82)";
  ctx.strokeStyle = active ? "#fbbf24" : "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f5f5f5";
  ctx.fillText(label, x + paddingX, y + h - 5);
}

export type DrawSkeletonOverlayInput = {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  landmarks: readonly BiomechanicsLandmark3D[];
  jointAngles: readonly BiomechanicsJointAngleSample[];
  phasePct?: number;
  viewMode?: BiomechanicsCaptureViewMode;
  activeLandmark?: string | null;
  showLandmarkNames?: boolean;
};

export function drawBiomechSkeletonOverlay(input: DrawSkeletonOverlayInput): void {
  const { ctx, width, height } = input;
  if (width < 8 || height < 8) return;

  const viewMode = input.viewMode ?? "monolateral_side";
  const showNames = input.showLandmarkNames !== false;

  ctx.clearRect(0, 0, width, height);

  const phase = typeof input.phasePct === "number" ? input.phasePct : 50;
  const resolvedLandmarks = resolveOverlayLandmarks(input.landmarks, viewMode);
  const angles = pickJointAnglesForPhase(input.jointAngles, phase);
  const index = landmarkIndex(resolvedLandmarks);
  const edges = getSkeletonEdgesForView(viewMode);
  const triples = getAngleTriplesForView(viewMode);

  const point = (name: string): Point2D | null => {
    const row = index.get(name);
    return row ? scaleLandmarkToCanvas(row, width, height) : null;
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [from, to] of edges) {
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
    if (showNames) {
      drawLandmarkNameLabel(ctx, p, landmarkLabelIt(row.name), active);
    }
  }

  for (const triple of triples) {
    const a = point(triple.a);
    const b = point(triple.b);
    const c = point(triple.c);
    if (!a || !b || !c) continue;

    const reported = findJointAngleDeg(angles, triple.joint, triple.side);
    if (reported == null) continue;

    drawAngleArc(ctx, a, b, c, triple.color);
    drawAngleBadge(ctx, b, `${Math.round(reported)}°`, triple.color);
  }
}