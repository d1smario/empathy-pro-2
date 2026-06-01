"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BiomechanicsCameraPlane, BiomechanicsJointAngleSample, BiomechanicsLandmark3D } from "@empathy/contracts";
import { capturePlaneToViewMode, captureViewModeLabel, type BiomechanicsCaptureViewMode } from "@/lib/biomechanics/biomech-capture-view";
import { deriveJointAnglesFromLandmarks, canvasToLandmarkCoords, findLandmarkAtCanvasPoint } from "@/lib/biomechanics/biomech-landmark-angles";
import {
  drawBiomechSkeletonOverlay,
  listAvailablePhases,
  MONOLATERAL_LANDMARK_IDS,
  landmarkLabelIt,
  resolveOverlayLandmarks,
} from "@/lib/biomechanics/biomech-skeleton-overlay";
import { Pro2Button } from "@/components/ui/empathy";

type Props = {
  jointAngles?: BiomechanicsJointAngleSample[];
  landmarks?: BiomechanicsLandmark3D[];
  videoUrl?: string | null;
  title?: string;
  editable?: boolean;
  cameraPlane?: BiomechanicsCameraPlane;
  viewMode?: BiomechanicsCaptureViewMode;
  onLandmarksChange?: (landmarks: BiomechanicsLandmark3D[], jointAngles: BiomechanicsJointAngleSample[]) => void;
};

export function BiomechanicsAngleOverlay({
  jointAngles = [],
  landmarks,
  videoUrl,
  title,
  editable = false,
  cameraPlane = "side",
  viewMode: viewModeProp,
  onLandmarksChange,
}: Props) {
  const viewMode = viewModeProp ?? capturePlaneToViewMode(cameraPlane);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<string | null>(null);
  const sizeRef = useRef({ width: 1, height: 1 });

  const [phasePct, setPhasePct] = useState(50);
  const [draftLandmarks, setDraftLandmarks] = useState<BiomechanicsLandmark3D[]>(() =>
    resolveOverlayLandmarks(landmarks, viewMode),
  );
  const [activeLandmark, setActiveLandmark] = useState<string | null>(null);
  const [baselineLandmarks, setBaselineLandmarks] = useState<BiomechanicsLandmark3D[]>(() =>
    resolveOverlayLandmarks(landmarks, viewMode),
  );

  const phases = useMemo(() => listAvailablePhases(jointAngles), [jointAngles]);
  const hasAngles = jointAngles.length > 0;

  const geometryAngles = useMemo(
    () => deriveJointAnglesFromLandmarks(draftLandmarks, jointAngles, viewMode),
    [draftLandmarks, jointAngles, viewMode],
  );

  const displayAngles = geometryAngles.length ? geometryAngles : jointAngles;

  useEffect(() => {
    const next = resolveOverlayLandmarks(landmarks, viewMode);
    setDraftLandmarks(next);
    setBaselineLandmarks(next);
  }, [landmarks, viewMode]);

  const emitChange = useCallback(
    (nextLandmarks: BiomechanicsLandmark3D[]) => {
      const normalized = resolveOverlayLandmarks(nextLandmarks, viewMode);
      const nextAngles = deriveJointAnglesFromLandmarks(normalized, jointAngles, viewMode);
      onLandmarksChange?.(normalized, nextAngles);
    },
    [jointAngles, onLandmarksChange, viewMode],
  );

  const updateLandmarkAt = useCallback((name: string, x: number, y: number) => {
    const { width, height } = sizeRef.current;
    const { xMm, yMm } = canvasToLandmarkCoords(x, y, width, height);
    setDraftLandmarks((prev) => prev.map((row) => (row.name === name ? { ...row, xMm, yMm, confidence01: 1 } : row)));
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !hasAngles) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    sizeRef.current = { width, height };
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawBiomechSkeletonOverlay({
      ctx,
      width,
      height,
      landmarks: draftLandmarks,
      jointAngles: displayAngles,
      phasePct,
      viewMode,
      activeLandmark,
      showLandmarkNames: true,
    });
  }, [activeLandmark, displayAngles, draftLandmarks, hasAngles, phasePct, viewMode]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [redraw]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => redraw();
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("loadeddata", onMeta);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("loadeddata", onMeta);
    };
  }, [redraw, videoUrl]);

  useEffect(() => {
    if (phases.includes(phasePct)) return;
    setPhasePct(phases.includes(50) ? 50 : phases[0]!);
  }, [phasePct, phases]);

  const clientPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!editable) return;
      const pt = clientPoint(event);
      if (!pt) return;
      const { width, height } = sizeRef.current;
      const name = findLandmarkAtCanvasPoint(draftLandmarks, pt.x, pt.y, width, height);
      if (!name) return;
      dragRef.current = name;
      setActiveLandmark(name);
      event.currentTarget.setPointerCapture(event.pointerId);
      updateLandmarkAt(name, pt.x, pt.y);
    },
    [clientPoint, draftLandmarks, editable, updateLandmarkAt],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!editable || !dragRef.current) return;
      const pt = clientPoint(event);
      if (!pt) return;
      updateLandmarkAt(dragRef.current, pt.x, pt.y);
    },
    [clientPoint, editable, updateLandmarkAt],
  );

  const finishDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setActiveLandmark(null);
    setDraftLandmarks((current) => {
      emitChange(current);
      return current;
    });
  }, [emitChange]);

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!editable) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      finishDrag();
    },
    [editable, finishDrag],
  );

  const onResetLandmarks = useCallback(() => {
    const reset = [...baselineLandmarks];
    setDraftLandmarks(reset);
    emitChange(reset);
  }, [baselineLandmarks, emitChange]);

  if (!hasAngles) {
    return (
      <p className="rounded-xl border border-white/10 px-4 py-3 text-sm text-gray-400">
        Nessun angolo strutturato per disegnare l&apos;overlay.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {title ? <p className="text-xs text-gray-400">{title}</p> : null}
      {editable ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <span className="font-semibold text-amber-50">{captureViewModeLabel(viewMode)}</span>
          {" · "}
          Punti ({MONOLATERAL_LANDMARK_IDS.map((id) => landmarkLabelIt(id)).join(" · ")}) — trascina sul video, un solo
          lato visibile. Gli angoli si ricalcolano in 2D; salva prima di confermare.
        </p>
      ) : (
        <p className="text-xs text-gray-500">{captureViewModeLabel(viewMode)}</p>
      )}
      {viewMode === "multiview" ? (
        <p className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
          Editor multi-view in fase 2. Per allineare i punti usa una cattura <strong>laterale</strong> (monolaterale).
        </p>
      ) : null}
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-xl border border-violet-500/25 bg-black"
      >
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="h-full w-full object-contain"
            controls
            playsInline
            muted
            crossOrigin="anonymous"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-950 via-black to-violet-950/40">
            <p className="text-xs text-gray-500">Anteprima scheletro · angoli CV</p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full touch-none ${editable ? "cursor-crosshair" : "pointer-events-none"}`}
          aria-label={editable ? "Editor landmark biomeccanici" : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {phases.length > 1 ? (
          <label className="flex min-w-[14rem] flex-1 flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className="font-mono uppercase tracking-[0.18em] text-violet-200">Fase ciclo</span>
            <input
              type="range"
              min={Math.min(...phases)}
              max={Math.max(...phases)}
              step={1}
              value={phasePct}
              onChange={(event) => setPhasePct(Number(event.currentTarget.value))}
              className="min-w-[10rem] flex-1 accent-fuchsia-500"
            />
            <span className="font-mono text-white">{phasePct}%</span>
          </label>
        ) : (
          <p className="text-xs text-gray-500">Fase analisi: {phasePct}% ciclo</p>
        )}
        {editable ? (
          <Pro2Button variant="secondary" type="button" onClick={onResetLandmarks} className="justify-center text-xs">
            Ripristina punti CV
          </Pro2Button>
        ) : null}
      </div>
    </div>
  );
}
