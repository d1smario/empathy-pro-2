"use client";

import { useCallback, useEffect, useState } from "react";
import type { AthleteHubOperationalErr, AthleteHubOperationalOk } from "@/lib/dashboard/athlete-hub-operational-contract";
import { athleteHubOperationalUrl } from "@/lib/dashboard/athlete-hub-operational-contract";
import { useActiveAthlete } from "@/lib/use-active-athlete";

export type UseAthleteOperationalHubResult = {
  athleteId: string | null;
  ctxLoading: boolean;
  loading: boolean;
  error: string | null;
  hub: AthleteHubOperationalOk | null;
  refetch: () => Promise<void>;
};

/**
 * Unica lettura client dell’hub operativo + segnali (stessa API per dashboard card e pagina Physiology bioenergetica).
 */
export function useAthleteOperationalHub(options?: { enabled?: boolean }): UseAthleteOperationalHubResult {
  const enabled = options?.enabled ?? true;
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [hub, setHub] = useState<AthleteHubOperationalOk | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!athleteId) {
      setHub(null);
      setErr("Nessun atleta attivo.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(athleteHubOperationalUrl(athleteId), { cache: "no-store", credentials: "same-origin" });
      const json = (await res.json()) as AthleteHubOperationalOk | AthleteHubOperationalErr;
      if (!res.ok || !json.ok) {
        setHub(null);
        setErr(("error" in json && json.error) || "Lettura non riuscita.");
        return;
      }
      setHub(json);
    } catch {
      setHub(null);
      setErr("Errore di rete.");
    } finally {
      setLoading(false);
    }
  }, [athleteId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (ctxLoading) return;
    void refetch();
  }, [ctxLoading, enabled, refetch]);

  return { athleteId, ctxLoading, loading, error: err, hub, refetch };
}
