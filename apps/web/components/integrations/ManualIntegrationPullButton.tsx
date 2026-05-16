"use client";

import { useState } from "react";
import { Pro2Button } from "@/components/ui/empathy";

type PullResult = {
  ok?: boolean;
  inserted?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
};

/**
 * POST thin verso `…/pull/run` (Strava, Wahoo, WHOOP) con sessione atleta.
 */
export function ManualIntegrationPullButton(props: {
  athleteId: string | null;
  linked: boolean;
  endpoint: string;
  label: string;
  className?: string;
}) {
  const { athleteId, linked, endpoint, label, className } = props;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function runPull() {
    if (!athleteId || !linked || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteId }),
      });
      const j = (await r.json()) as PullResult;
      if (j.ok) {
        setNotice(
          `Completato: inseriti ${j.inserted ?? 0}, saltati ${j.skipped ?? 0}.` +
            (Array.isArray(j.errors) && j.errors.length > 0 ? ` Avvisi: ${j.errors.slice(0, 2).join(" · ")}` : ""),
        );
      } else {
        setNotice(j.error ?? `Errore HTTP ${r.status}`);
      }
    } catch {
      setNotice("Errore di rete.");
    } finally {
      setBusy(false);
    }
  }

  if (!athleteId) return null;

  return (
    <div className={className}>
      <Pro2Button type="button" variant="secondary" disabled={!linked || busy} onClick={() => void runPull()}>
        {busy ? "Aggiornamento…" : label}
      </Pro2Button>
      {notice ? (
        <p className="mt-2 text-xs text-white/75" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
