import type { BiomechanicsJointAngleSample, BiomechanicsLandmark3D } from "@empathy/contracts";

import type { BiomechanicsCaptureViewMode } from "@/lib/biomechanics/biomech-capture-view";
import {
  angleBetweenPoints,
  getAngleTriplesForView,
  landmarkIndex,
  listAvailablePhases,
  normalizeMonolateralLandmarks,
  type Point2D,
} from "@/lib/biomechanics/biomech-skeleton-overlay";

function landmarkPoint(row: BiomechanicsLandmark3D): Point2D {
  return { x: row.xMm, y: row.yMm };
}

/** Ricalcola angoli articolari dalla geometria landmark (piano 2D, presa monolaterale). */
export function deriveJointAnglesFromLandmarks(
  landmarks: readonly BiomechanicsLandmark3D[],
  phaseTemplate: readonly BiomechanicsJointAngleSample[] = [],
  viewMode: BiomechanicsCaptureViewMode = "monolateral_side",
): BiomechanicsJointAngleSample[] {
  const normalized = normalizeMonolateralLandmarks(landmarks);
  const index = landmarkIndex(normalized);
  const phases = listAvailablePhases(phaseTemplate);
  const triples = getAngleTriplesForView(viewMode);
  const out: BiomechanicsJointAngleSample[] = [];

  for (const phasePct of phases) {
    for (const triple of triples) {
      const a = index.get(triple.a);
      const b = index.get(triple.b);
      const c = index.get(triple.c);
      if (!a || !b || !c) continue;

      const angleDeg = angleBetweenPoints(landmarkPoint(a), landmarkPoint(b), landmarkPoint(c));
      if (!Number.isFinite(angleDeg)) continue;

      out.push({
        joint: triple.joint,
        side: triple.side,
        angleDeg,
        phasePct: phases.length > 1 ? phasePct : undefined,
        confidence01: 0.95,
      });
    }
  }

  return out;
}

export function canvasToLandmarkCoords(
  x: number,
  y: number,
  width: number,
  height: number,
): { xMm: number; yMm: number } {
  const xMm = Math.min(1000, Math.max(0, (x / width) * 1000));
  const yMm = Math.min(1000, Math.max(0, (y / height) * 1000));
  return { xMm, yMm };
}

export function findLandmarkAtCanvasPoint(
  landmarks: readonly BiomechanicsLandmark3D[],
  x: number,
  y: number,
  width: number,
  height: number,
  hitRadiusPx = 18,
): string | null {
  let best: { name: string; dist: number } | null = null;
  for (const row of landmarks) {
    const px = (row.xMm / 1000) * width;
    const py = (row.yMm / 1000) * height;
    const dist = Math.hypot(px - x, py - y);
    if (dist > hitRadiusPx) continue;
    if (!best || dist < best.dist) best = { name: row.name, dist };
  }
  return best?.name ?? null;
}
