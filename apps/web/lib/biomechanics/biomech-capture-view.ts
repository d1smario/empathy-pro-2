import type { BiomechanicsCameraPlane } from "@empathy/contracts";

/** Modello overlay landmark: monolaterale (2D su piano sagittale) vs multi-view (fase 2). */
export type BiomechanicsCaptureViewMode = "monolateral_side" | "multiview";

export function capturePlaneToViewMode(plane: BiomechanicsCameraPlane | undefined): BiomechanicsCaptureViewMode {
  if (plane === "multi_view") return "multiview";
  return "monolateral_side";
}

export function captureViewModeLabel(mode: BiomechanicsCaptureViewMode): string {
  switch (mode) {
    case "monolateral_side":
      return "Presa laterale monolaterale (piano 2D)";
    case "multiview":
      return "Multi-view (in arrivo)";
  }
}
