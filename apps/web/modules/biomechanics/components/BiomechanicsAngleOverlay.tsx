"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BiomechanicsJointAngleSample, BiomechanicsLandmark3D } from "@empathy/contracts";
import {
  drawBiomechSkeletonOverlay,
  listAvailablePhases,
  resolveOverlayLandmarks,
} from "@/lib/biomechanics/biomech-skeleton-overlay";

type Props = {
  jointAngles?: BiomechanicsJointAngleSample[];
  landmarks?: BiomechanicsLandmark3D[];
  videoUrl?: string | null;
  title?: string;
};

export function BiomechanicsAngleOverlay({ jointAngles = [], landmarks, videoUrl, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phasePct, setPhasePct] = useState(50);

  const phases = useMemo(() => listAvailablePhases(jointAngles), [jointAngles]);
  const overlayLandmarks = useMemo(() => resolveOverlayLandmarks(landmarks), [landmarks]);
  const hasAngles = jointAngles.length > 0;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !hasAngles) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
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
      landmarks: overlayLandmarks,
      jointAngles,
      phasePct,
    });
  }, [hasAngles, jointAngles, overlayLandmarks, phasePct]);

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
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
      </div>
      {phases.length > 1 ? (
        <label className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span className="font-mono uppercase tracking-[0.18em] text-violet-200">Fase ciclo</span>
          <input
            type="range"
            min={Math.min(...phases)}
            max={Math.max(...phases)}
            step={1}
            value={phasePct}
            onChange={(event) => setPhasePct(Number(event.currentTarget.value))}
            className="min-w-[12rem] flex-1 accent-fuchsia-500"
          />
          <span className="font-mono text-white">{phasePct}%</span>
        </label>
      ) : (
        <p className="text-xs text-gray-500">Fase analisi: {phasePct}% ciclo</p>
      )}
    </div>
  );
}
