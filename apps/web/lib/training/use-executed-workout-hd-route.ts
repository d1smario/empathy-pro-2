"use client";

import type { ExecutedWorkout } from "@empathy/domain-training";
import { useEffect, useMemo, useState } from "react";

import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import {
  geoPointsFromWorkoutTrace,
  geoTuplesFromGeoPoints,
  isGarminStartOnlyRouteMarker,
  isSubstantialGpsRouteTuples,
  parseRouteForDisplay,
  pickBestGeoRoutePoints,
  pickParserEngineFromTrace,
  routeNeedsHdFetchFromDb,
  traceRecord,
} from "@/lib/training/calendar-analyzer-helpers";
import { type GeoPoint, isGeoPoint } from "@/lib/training/series-channel-registry";

export type ExecutedWorkoutHdRouteState = {
  /** Punti migliori disponibili (trace + eventuale HD da DB). */
  points: GeoPoint[];
  /** Polyline per mappe stile Leaflet (`[lat, lon][]`). */
  routeTuples: Array<[number, number]>;
  /** Almeno 2 coordinate GPS distinte → tracciato reale. */
  isSubstantial: boolean;
  /** Marker Garmin summary (2 punti coincidenti). */
  isStartOnlyMarker: boolean;
  /** Summary Garmin senza enrich FIT/GPX ancora in corso. */
  isGarminSummaryPending: boolean;
  loading: boolean;
};

/**
 * Route GPS per Calendar session detail e Analyzer: legge `trace_summary` (incl. `route_series_geo`)
 * e, se serve, scarica il canale `route` da `executed_workout_series`.
 */
export function useExecutedWorkoutHdRoute(input: {
  athleteId?: string | null;
  workout?: ExecutedWorkout | null;
}): ExecutedWorkoutHdRouteState {
  const workout = input.workout ?? null;
  const athleteId = input.athleteId?.trim() || null;
  const executedId = workout?.id?.trim() || null;

  const trace = useMemo(() => (workout ? traceRecord(workout) : null), [workout]);
  const tracePoints = useMemo(() => (workout ? geoPointsFromWorkoutTrace(workout) : []), [workout]);
  const traceTuples = useMemo(() => parseRouteForDisplay(trace), [trace]);
  const parserEngine = useMemo(() => pickParserEngineFromTrace(trace), [trace]);

  const [dbPoints, setDbPoints] = useState<GeoPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setDbPoints([]);
  }, [executedId]);

  useEffect(() => {
    if (!athleteId || !executedId) return;

    const needsRouteFromDb = routeNeedsHdFetchFromDb({
      tracePoints,
      parserEngine,
    });
    if (!needsRouteFromDb) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const q = new URLSearchParams({ athleteId, executedId, channels: "route" });
        const res = await fetch(`/api/training/session-series?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as
          | {
              ok: true;
              channels: Array<{ channel: string; samples: unknown[] }>;
            }
          | { ok: false };
        if (cancelled || !("ok" in json) || !json.ok) return;

        const routeChannel = json.channels.find((c) => c.channel === "route");
        const pts = (Array.isArray(routeChannel?.samples) ? routeChannel.samples : []).filter(
          isGeoPoint,
        ) as GeoPoint[];
        if (pts.length >= 1) setDbPoints(pts);
      } catch {
        /* best-effort */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [athleteId, executedId, parserEngine, tracePoints]);

  return useMemo(() => {
    const points = pickBestGeoRoutePoints(tracePoints, dbPoints);
    const tuplesFromPoints = geoTuplesFromGeoPoints(points);
    const routeTuples = isSubstantialGpsRouteTuples(tuplesFromPoints)
      ? tuplesFromPoints
      : isSubstantialGpsRouteTuples(traceTuples)
        ? traceTuples
        : [];
    const isSubstantial = routeTuples.length >= 2 && isSubstantialGpsRouteTuples(routeTuples);
    const isStartOnlyMarker = !isSubstantial && isGarminStartOnlyRouteMarker(points);
    const isGarminSummaryPending =
      !isSubstantial &&
      parserEngine === "garmin_wellness_api_summary" &&
      (isStartOnlyMarker || points.length > 0);

    return {
      points,
      routeTuples,
      isSubstantial,
      isStartOnlyMarker,
      isGarminSummaryPending,
      loading,
    };
  }, [tracePoints, dbPoints, traceTuples, parserEngine, loading]);
}
