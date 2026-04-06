"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { Pro2Link } from "@/components/ui/empathy";

type HubOk = {
  ok: true;
  athleteId: string;
  window: { from: string; to: string };
  profile: { line: string } | null;
  training: { plannedCount: number; executedCount: number };
  nutrition: { constraintsLine: string | null; plansCount: number };
  physiology: { line: string } | null;
  health: { panelsCount: number; lastPanelLabel: string | null };
};

type HubErr = { ok: false; error?: string };

function HubRow({
  href,
  title,
  children,
}: {
  href: `/${string}`;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-white/10 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Pro2Link href={href} variant="ghost" className="shrink-0 font-mono text-[0.65rem] uppercase tracking-wider text-pink-300">
          {title}
        </Pro2Link>
      </div>
      <div className="mt-1 text-sm leading-relaxed text-gray-300">{children}</div>
    </div>
  );
}

export function DashboardAthleteHubCard() {
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [hub, setHub] = useState<HubOk | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setHub(null);
      setErr("Nessun atleta attivo.");
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/dashboard/athlete-hub?athleteId=${encodeURIComponent(athleteId)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as HubOk | HubErr;
        if (c) return;
        if (!res.ok || !json.ok) {
          setHub(null);
          setErr(("error" in json && json.error) || "Lettura non riuscita.");
          return;
        }
        setHub(json);
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
      className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/30 p-6 text-left backdrop-blur-md"
      aria-label="Riepilogo atleta"
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-orange-300">Dashboard · dati reali</p>
      <h2 className="mt-2 text-lg font-bold text-white">Hub operativo</h2>
      <p className="mt-1 text-xs text-gray-500">
        Sintesi da Supabase per l&apos;atleta attivo; training con finestra calendario (default −7 / +28 giorni).
      </p>

      {ctxLoading || loading ? (
        <div className="mt-6 h-2 w-48 animate-pulse rounded-full bg-white/10" />
      ) : null}

      {!ctxLoading && !loading && err ? (
        <p className="mt-6 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {!ctxLoading && !loading && !err && hub ? (
        <div className="mt-6">
          <p className="mb-2 font-mono text-[0.6rem] text-gray-500">
            Finestra training: {hub.window.from} → {hub.window.to}
          </p>
          <HubRow href="/profile" title="Profile">
            {hub.profile?.line ?? "Nessun record in athlete_profiles."}
          </HubRow>
          <HubRow href="/training" title="Training">
            <span>
              {hub.training.plannedCount} pianificati · {hub.training.executedCount} eseguiti
            </span>
            <span className="mt-2 block">
              <Pro2Link href="/training/builder" variant="secondary" className="text-xs">
                Apri builder (vista densa KPI + famiglie)
              </Pro2Link>
            </span>
          </HubRow>
          <HubRow href="/nutrition" title="Nutrition">
            {hub.nutrition.constraintsLine ?? "Nessun vincolo in nutrition_constraints."}
            {hub.nutrition.plansCount > 0 ? (
              <span className="text-gray-500"> · {hub.nutrition.plansCount} piani</span>
            ) : (
              <span className="text-gray-500"> · 0 piani</span>
            )}
          </HubRow>
          <HubRow href="/physiology" title="Physiology">
            {hub.physiology?.line ?? "Nessun physiological_profiles recente."}
          </HubRow>
          <HubRow href="/health" title="Health">
            {hub.health.panelsCount} pannelli biomarker
            {hub.health.lastPanelLabel ? (
              <span className="text-gray-500"> · ultimo: {hub.health.lastPanelLabel}</span>
            ) : null}
          </HubRow>
        </div>
      ) : null}
    </section>
  );
}
