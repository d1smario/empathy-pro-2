"use client";

import { useEffect, useMemo, useRef } from "react";

type LatLng = [number, number];

type StravaStyleMapProps = {
  route: LatLng[];
  height?: number;
};

/** Tipi minimi per Leaflet caricato da CDN (evita `any` e regole eslint non installate). */
type LeafletMapHandle = {
  remove: () => void;
  fitBounds: (bounds: unknown, options?: { padding?: number[] }) => void;
};

/** Layer Leaflet: `addTo` restituisce lo stesso layer per `getBounds()` dopo la catena. */
type PolylineLayer = {
  addTo: (map: LeafletMapHandle) => PolylineLayer;
  getBounds: () => unknown;
};

type LeafletApi = {
  map: (el: HTMLElement, options: { zoomControl?: boolean; attributionControl?: boolean }) => LeafletMapHandle;
  tileLayer: (url: string, options: { maxZoom?: number }) => { addTo: (map: LeafletMapHandle) => void };
  polyline: (latlngs: LatLng[], options: { color?: string; weight?: number; opacity?: number }) => PolylineLayer;
  circleMarker: (latlng: LatLng, options: Record<string, string | number>) => { addTo: (map: LeafletMapHandle) => void };
};

declare global {
  interface Window {
    L?: LeafletApi;
  }
}

function ensureLeafletAssets() {
  if (!document.getElementById("leaflet-css")) {
    const link = document.createElement("link");
    link.id = "leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
}

function loadLeafletScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve();
      return;
    }
    const existing = document.getElementById("leaflet-js");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Leaflet load failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Leaflet load failed"));
    document.body.appendChild(script);
  });
}

export function StravaStyleMap({ route, height = 280 }: StravaStyleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapHandle | null>(null);

  const normalizedRoute = useMemo(() => (route.length >= 2 ? route : [[45.4642, 9.19], [45.472, 9.205]]), [route]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      ensureLeafletAssets();
      await loadLeafletScript();
      if (cancelled || !containerRef.current || !window.L) return;

      if (mapRef.current) {
        mapRef.current.remove();
      }

      const L = window.L;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);

      const polyline = L.polyline(normalizedRoute as LatLng[], {
        color: "#ff6a00",
        weight: 4,
        opacity: 0.95,
      }).addTo(map);

      const start = normalizedRoute[0] as LatLng;
      const end = normalizedRoute[normalizedRoute.length - 1] as LatLng;
      L.circleMarker(start, { radius: 5, color: "#ff9e4a", fillColor: "#ff9e4a", fillOpacity: 1, weight: 2 }).addTo(map);
      L.circleMarker(end, { radius: 5, color: "#f43f5e", fillColor: "#f43f5e", fillOpacity: 1, weight: 2 }).addTo(map);

      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
      mapRef.current = map;
    }

    init().catch(() => {
      // CDN blocked: silent fallback shell
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [normalizedRoute]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid rgba(122,122,122,0.36)",
      }}
    />
  );
}
