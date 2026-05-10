"use client";

import { useMemo } from "react";

import { cn } from "@/lib/cn";
import type { GeoPoint } from "@/lib/training/series-channel-registry";

/**
 * Mini-mappa SVG della traccia GPS — palette Pro 2 (nero + gradiente fucsia/viola/arancio).
 * Niente librerie di mappe (no Leaflet/Mapbox), no API key, no tile esterne: la traccia
 * stessa è il dato. Adeguata a sessioni reali (Garmin Activity Details, file FIT/GPX/TCX).
 *
 * Comportamento:
 *   - >= 2 punti distinti → polyline con bounding box auto-fit + start/end markers
 *   - == 1 punto reale (o 2 coincidenti, fallback marker da summary) → solo marker centrato
 *   - lista vuota / null → componente non renderizza nulla
 *
 * La proiezione è lat/lon equirettangolare locale (compensata col coseno della latitudine
 * media). Per le distanze tipiche di una sessione (< 500 km) la distorsione è invisibile.
 */
export type SessionRouteMapProps = {
  points: GeoPoint[] | null | undefined;
  className?: string;
  height?: number;
};

const VIEW_W = 600;
const PADDING = 16;

export function SessionRouteMap({ points, className, height = 240 }: SessionRouteMapProps) {
  const projection = useMemo(() => {
    if (!points || points.length === 0) return null;

    const seen = new Set<string>();
    const distinct: GeoPoint[] = [];
    for (const p of points) {
      const key = `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      distinct.push(p);
    }
    if (distinct.length === 0) return null;

    const lats = distinct.map((p) => p.lat);
    const lons = distinct.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const midLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos((midLat * Math.PI) / 180) || 1;

    const spanLat = Math.max(maxLat - minLat, 1e-6);
    const spanLon = Math.max((maxLon - minLon) * cosLat, 1e-6);

    const innerW = VIEW_W - PADDING * 2;
    const innerH = height - PADDING * 2;

    const scale = Math.min(innerW / spanLon, innerH / spanLat);
    const drawW = spanLon * scale;
    const drawH = spanLat * scale;
    const offsetX = PADDING + (innerW - drawW) / 2;
    const offsetY = PADDING + (innerH - drawH) / 2;

    const project = (p: GeoPoint): { x: number; y: number } => ({
      x: offsetX + (p.lon - minLon) * cosLat * scale,
      y: offsetY + (maxLat - p.lat) * scale,
    });

    return { distinct, project, isMarkerOnly: distinct.length === 1 };
  }, [points, height]);

  if (!projection) return null;

  const { distinct, project, isMarkerOnly } = projection;

  if (isMarkerOnly) {
    const { x, y } = project(distinct[0]!);
    return (
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        className={cn("w-full rounded-2xl border border-white/10 bg-zinc-950", className)}
        role="img"
        aria-label="Punto di partenza GPS"
      >
        <defs>
          <radialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f0abfc" stopOpacity={0.55} />
            <stop offset="60%" stopColor="#f0abfc" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#f0abfc" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={x} cy={y} r={28} fill="url(#markerGlow)" />
        <circle cx={x} cy={y} r={6} fill="#f0abfc" />
        <circle cx={x} cy={y} r={2} fill="#0a0a0a" />
        <text
          x={x + 12}
          y={y + 4}
          fontSize={11}
          fontFamily="ui-monospace, monospace"
          fill="#a1a1aa"
        >
          start
        </text>
      </svg>
    );
  }

  const projected = distinct.map(project);
  const polylinePoints = projected.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const start = projected[0]!;
  const end = projected[projected.length - 1]!;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      className={cn("w-full rounded-2xl border border-white/10 bg-zinc-950", className)}
      role="img"
      aria-label={`Traccia GPS — ${distinct.length} punti`}
    >
      <defs>
        <linearGradient id="routeStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
        <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polyline
        points={polylinePoints}
        fill="none"
        stroke="url(#routeStroke)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        filter="url(#routeGlow)"
      />

      <g>
        <circle cx={start.x} cy={start.y} r={5} fill="#f0abfc" stroke="#0a0a0a" strokeWidth={1.5} />
        <text
          x={start.x + 8}
          y={start.y - 6}
          fontSize={10}
          fontFamily="ui-monospace, monospace"
          fill="#f0abfc"
          fontWeight={700}
        >
          START
        </text>
      </g>
      <g>
        <circle cx={end.x} cy={end.y} r={5} fill="#fb923c" stroke="#0a0a0a" strokeWidth={1.5} />
        <text
          x={end.x + 8}
          y={end.y + 14}
          fontSize={10}
          fontFamily="ui-monospace, monospace"
          fill="#fb923c"
          fontWeight={700}
        >
          END
        </text>
      </g>
    </svg>
  );
}
