"use client";

import { useCallback, useState } from "react";
import type { IntelligentMealPlanV2Preview } from "@empathy/contracts";
import type { IntelligentMealPlanRequest } from "@/lib/nutrition/intelligent-meal-plan-types";
import { Pro2Button } from "@/components/ui/empathy/Pro2Button";
import { fetchMealPlanV2Preview } from "@/modules/nutrition/services/intelligent-meal-plan-v2-api";

type Props = {
  athleteId: string;
  planRequest: IntelligentMealPlanRequest | null;
};

export function MealPlanV2PreviewPanel({ athleteId, planRequest }: Props) {
  const [preview, setPreview] = useState<IntelligentMealPlanV2Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!athleteId || !planRequest) return;
    setLoading(true);
    setError(null);
    const result = await fetchMealPlanV2Preview(athleteId, planRequest);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(result.body.preview);
  }, [athleteId, planRequest]);

  const req = preview?.requirements;

  return (
    <section className="viz-card builder-panel border border-violet-500/25 bg-black/20 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="m-0 text-[0.65rem] font-bold uppercase tracking-wider text-violet-300/90">
            Nutrition V2 · anteprima (beta)
          </p>
          <p className="m-0 mt-1 text-[0.75rem] leading-relaxed text-slate-400">
            Anteprima motore V2 (USDA FDC taggato + fueling substrati). Produzione: imposta{" "}
            <code className="text-violet-300/80">NUTRITION_MEAL_PLAN_ENGINE=v2</code> o shadow per confronto.
          </p>
        </div>
        <Pro2Button type="button" variant="secondary" disabled={!planRequest || loading} onClick={() => void load()}>
          {loading ? "Caricamento…" : "Anteprima V2"}
        </Pro2Button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-300/90" role="alert">
          {error}
        </p>
      ) : null}

      {req ? (
        <div className="mt-4 space-y-4 text-sm text-slate-300">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="m-0 text-[0.6rem] uppercase tracking-wider text-slate-500">Strategia</p>
              <p className="m-0 font-semibold text-white">{req.strategyKind}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="m-0 text-[0.6rem] uppercase tracking-wider text-slate-500">Profilo dieta (asse 4)</p>
              <p className="m-0 font-semibold text-white">{req.dietProfileActive}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="m-0 text-[0.6rem] uppercase tracking-wider text-slate-500">CHO totale</p>
              <p className="m-0 font-semibold text-white">{req.macros.total.choG} g</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="m-0 text-[0.6rem] uppercase tracking-wider text-slate-500">PRO / FAT</p>
              <p className="m-0 font-semibold text-white">
                {req.macros.total.proG} g · {req.macros.total.fatG} g
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="m-0 text-[0.6rem] uppercase tracking-wider text-slate-500">Pasti (Diet)</p>
              <p className="m-0 font-semibold text-white">{req.energy.mealsKcal} kcal</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="m-0 text-[0.6rem] uppercase tracking-wider text-slate-500">Fueling (CHO substrati)</p>
              <p className="m-0 font-semibold text-white">{req.energy.fuelingKcal} kcal</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="m-0 text-[0.6rem] uppercase tracking-wider text-slate-500">Strategia g/kg</p>
              <p className="m-0 font-semibold text-white">
                CHO {req.dailyMacroTargetsGPerKg.choMinGPerKg}–{req.dailyMacroTargetsGPerKg.choMaxGPerKg} · PRO{" "}
                {req.dailyMacroTargetsGPerKg.proGPerKg} · FAT {req.dailyMacroTargetsGPerKg.fatGPerKg}
              </p>
            </div>
          </div>

          {req.substrateFueling?.sessions.length ? (
            <div>
              <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wider text-orange-300/90">
                Fueling intra (da CHO bruciato, non % kcal training)
              </p>
              <ul className="m-0 list-none space-y-1 p-0 font-mono text-[11px] text-slate-400">
                {req.substrateFueling.sessions.map((s) => (
                  <li key={s.sessionLabel}>
                    {s.sessionLabel}: CHO burn {s.choBurnedG} g · share energia {Math.round(s.choEnergyShare * 100)}% ·
                    intra {s.intraChoG} g ({s.intraChoGPerH} g/h, replace {Math.round(s.intraChoReplaceFraction * 100)}
                    %)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {req.substrateRates.length > 0 ? (
            <div>
              <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Substrati seduta</p>
              <ul className="m-0 list-none space-y-1 p-0 font-mono text-[11px] text-slate-400">
                {req.substrateRates.map((s) => (
                  <li key={s.sessionLabel}>
                    {s.sessionLabel}: {s.choGPerH} g CHO/h · {s.fatGPerH} g FAT/h · {s.durationH} h
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.dietMealSlotBudgets && preview.dietMealSlotBudgets.length > 0 ? (
            <div>
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-violet-400/90">
                Slot pasti · Profile Diet
              </p>
              <ul className="m-0 list-none space-y-0.5 p-0 text-[11px] text-slate-400">
                {preview.dietMealSlotBudgets.map((sl) => (
                  <li key={sl.key}>
                    {sl.label}: {sl.pct.toFixed(0)}% → {sl.kcal} kcal (CHO {sl.carbs} · PRO {sl.protein} g)
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.composedMealPlan && preview.composedMealPlan.length > 0 ? (
            <div>
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-emerald-400/90">
                Bozza piano (composer V2)
              </p>
              <div className="space-y-2">
                {preview.composedMealPlan.map((slot) => (
                  <div key={slot.slot} className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2">
                    <p className="m-0 text-xs font-semibold text-slate-200">
                      {slot.labelIt}{" "}
                      <span className="font-normal text-slate-500">
                        target {slot.targetKcal} kcal → {slot.totals.kcal} kcal
                      </span>
                    </p>
                    {slot.items.length === 0 ? (
                      <p className="m-0 mt-1 text-[11px] text-amber-200/80">Pool vuoto per questo slot.</p>
                    ) : (
                      <ul className="m-0 mt-1 list-none space-y-0.5 p-0 text-[11px] text-slate-400">
                        {slot.items.map((it) => (
                          <li key={it.fdcId}>
                            {it.grams} g {it.description} — {it.kcal} kcal (CHO {it.choG} · PRO {it.proG} g)
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {preview.foodPoolsBySlot.length > 0 ? (
            <div>
              <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
                Pool USDA filtrati ({preview.taxonomyVersion})
              </p>
              <div className="space-y-3">
                {preview.foodPoolsBySlot.map((pool) => (
                  <div key={pool.slot} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="m-0 text-xs font-semibold text-slate-200">
                      {pool.labelIt}{" "}
                      <span className="font-normal text-slate-500">({pool.filterSummary})</span>
                    </p>
                    {pool.candidates.length === 0 ? (
                      <p className="m-0 mt-1 text-[11px] text-amber-200/80">Nessun candidato — verifica cache USDA / migration 075.</p>
                    ) : (
                      <ul className="m-0 mt-1 list-none space-y-0.5 p-0 text-[11px] text-slate-400">
                        {pool.candidates.slice(0, 5).map((c) => (
                          <li key={c.fdcId}>
                            {c.description}
                            {c.tags.dietProfile?.length ? (
                              <span className="text-violet-300/70"> · {c.tags.dietProfile.slice(0, 3).join(",")}</span>
                            ) : null}
                            {c.tags.aminoProfile?.length ? (
                              <span className="text-fuchsia-300/70"> · {c.tags.aminoProfile.slice(0, 2).join(",")}</span>
                            ) : null}
                          </li>
                        ))}
                        {pool.candidates.length > 5 ? (
                          <li className="text-slate-600">+{pool.candidates.length - 5} altri</li>
                        ) : null}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="m-0 text-[11px] leading-relaxed text-slate-500">{preview.disclaimer}</p>
        </div>
      ) : null}
    </section>
  );
}
