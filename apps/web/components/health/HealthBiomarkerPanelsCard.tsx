"use client";

import { useEffect, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { fetchHealthPanelsTimeline, type HealthPanelTimelineRow } from "@/modules/health/services/health-module-api";

type BiomarkerPanelRow = {
  id: string;
  type: string;
  sample_date: string | null;
  reported_at: string | null;
};

export function HealthBiomarkerPanelsCard() {
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [panels, setPanels] = useState<BiomarkerPanelRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setPanels([]);
      setErr("Nessun atleta attivo.");
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { panels: timelinePanels, error } = await fetchHealthPanelsTimeline(athleteId);
        if (c) return;
        if (error) {
          setPanels([]);
          setErr(error);
          return;
        }
        const compactRows: BiomarkerPanelRow[] = (timelinePanels as HealthPanelTimelineRow[]).map((p) => ({
          id: p.id,
          type: p.type,
          sample_date: p.sample_date,
          reported_at: p.reported_at,
        }));
        setPanels(compactRows.slice(0, 8));
      } catch {
        if (!c) setErr("Errore di rete.");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [athleteId, ctxLoading]);

  return (
    <section
      className="w-full max-w-lg rounded-2xl border border-white/10 bg-black/30 p-6 text-left backdrop-blur-md"
      aria-label="Panel biomarkers"
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-rose-300">Health · dati reali</p>
      <h2 className="mt-2 text-lg font-bold text-white">Biomarkers recenti</h2>

      {ctxLoading || loading ? (
        <div className="mt-4 h-2 w-36 animate-pulse rounded-full bg-white/10" />
      ) : null}

      {!ctxLoading && !loading && err ? (
        <p className="mt-4 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {!ctxLoading && !loading && !err && panels.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Nessun panel in database per questo atleta.</p>
      ) : null}

      {!ctxLoading && !loading && !err && panels.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
          {panels.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200"
            >
              <span className="font-medium text-white">{p.type}</span>
              <span className="mx-2 text-gray-600">·</span>
              <span className="font-mono text-xs text-gray-500">
                {p.sample_date ?? p.reported_at?.slice(0, 10) ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
