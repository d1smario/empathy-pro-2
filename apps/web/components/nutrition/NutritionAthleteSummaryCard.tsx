"use client";

import {
  formatNutritionConstraintsLine,
  formatNutritionPlanLine,
  type NutritionConstraints,
  type NutritionPlan,
} from "@empathy/domain-nutrition";
import { useEffect, useState } from "react";
import { useActiveAthlete } from "@/lib/use-active-athlete";

type ApiOk = { ok: true; athleteId: string; constraints: NutritionConstraints | null; plans: NutritionPlan[] };
type ApiErr = { ok: false; error?: string };

export function NutritionAthleteSummaryCard() {
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [constraints, setConstraints] = useState<NutritionConstraints | null>(null);
  const [plans, setPlans] = useState<NutritionPlan[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (ctxLoading) return;
    if (!athleteId) {
      setConstraints(null);
      setPlans([]);
      setErr("Nessun atleta attivo.");
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/nutrition/athlete-summary?athleteId=${encodeURIComponent(athleteId)}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiOk | ApiErr;
        if (c) return;
        if (!res.ok || !json.ok) {
          setConstraints(null);
          setPlans([]);
          setErr(("error" in json && json.error) || "Lettura non riuscita.");
          return;
        }
        setConstraints(json.constraints);
        setPlans(json.plans);
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
      aria-label="Riepilogo nutrizione"
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-emerald-300">Nutrition · dati reali</p>
      <h2 className="mt-2 text-lg font-bold text-white">Vincoli e piani</h2>

      {ctxLoading || loading ? (
        <div className="mt-4 space-y-2">
          <div className="h-2 w-44 animate-pulse rounded-full bg-white/10" />
        </div>
      ) : null}

      {!ctxLoading && !loading && err ? (
        <p className="mt-4 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {!ctxLoading && !loading && !err && !constraints && plans.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Nessun vincolo o piano in database per questo atleta.</p>
      ) : null}

      {!ctxLoading && !loading && !err && constraints ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <h3 className="font-mono text-[0.6rem] uppercase tracking-wider text-gray-500">Vincoli</h3>
          <p className="mt-1 text-sm text-gray-200">{formatNutritionConstraintsLine(constraints)}</p>
        </div>
      ) : null}

      {!ctxLoading && !loading && !err && plans.length > 0 ? (
        <div className="mt-4 border-t border-white/10 pt-4">
          <h3 className="font-mono text-[0.6rem] uppercase tracking-wider text-gray-500">Piani recenti</h3>
          <ul className="mt-2 space-y-2">
            {plans.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200"
              >
                {formatNutritionPlanLine(p)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
