"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, LineChart, Timer } from "lucide-react";
import type {
  BioenergeticMetricTile,
  BioenergeticMetricTileCategory,
  BioenergeticPathwayImpact,
  BioenergeticsDayViewModel,
} from "@/api/bioenergetics/contracts";
import { GenerativeModuleSubnav } from "@/components/navigation/GenerativeModuleSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import {
  readPersistedNutritionPlanDate,
  writePersistedNutritionPlanDate,
} from "@/lib/nutrition/persisted-nutrition-plan-date";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { BioenergeticsContinuousMonitoringGrid } from "@/modules/bioenergetics/components/BioenergeticsContinuousMonitoringGrid";
import { BioenergeticsDaySeriesPanel } from "@/modules/bioenergetics/components/BioenergeticsDaySeriesPanel";
import { BioenergeticsPathway24Chart } from "@/modules/bioenergetics/components/BioenergeticsPathway24Chart";

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function coerceIsoDate(s: string | null | undefined): string | null {
  const u = (s ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(u) ? u : null;
}

const CATEGORY_LABEL: Record<BioenergeticMetricTileCategory, string> = {
  metabolic: "Metabolismo & substrati",
  inflammatory: "Infiammazione (contesto)",
  hormonal: "Ormonale",
  neural: "Neuromodulatori",
  gastro_intestinal: "Gastro-enterico",
  gonadal: "Asse gonadico",
};

function impactTileClass(impact: BioenergeticPathwayImpact): string {
  if (impact === "supportive") return "border-emerald-400/35 bg-emerald-500/[0.07]";
  if (impact === "inhibitory") return "border-rose-400/35 bg-rose-500/[0.07]";
  return "border-white/12 bg-white/[0.04]";
}

function provenanceLabel(p: BioenergeticMetricTile["provenance"]): string {
  if (p === "measured") return "Misurato";
  if (p === "estimated") return "Stimato";
  if (p === "planned") return "Da piano";
  return "Assente";
}

export default function BioenergeticsPageView() {
  const searchParams = useSearchParams();
  const { athleteId, loading: athleteLoading } = useActiveAthlete();
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vm, setVm] = useState<BioenergeticsDayViewModel | null>(null);
  const seededFromContext = useRef(false);

  useEffect(() => {
    seededFromContext.current = false;
  }, [athleteId]);

  useEffect(() => {
    const fromUrl = coerceIsoDate(searchParams.get("date"));
    if (fromUrl) {
      setDate((d) => (d === fromUrl ? d : fromUrl));
      seededFromContext.current = true;
      return;
    }
    if (!athleteId || athleteLoading) return;
    if (seededFromContext.current) return;
    seededFromContext.current = true;
    const persisted = readPersistedNutritionPlanDate(athleteId);
    if (persisted) setDate((d) => (d === persisted ? d : persisted));
  }, [searchParams, athleteId, athleteLoading]);

  const setDateAndPersist = useCallback(
    (next: string) => {
      const k = coerceIsoDate(next);
      if (!k) return;
      setDate(k);
      if (athleteId) writePersistedNutritionPlanDate(athleteId, k);
      if (typeof window !== "undefined") {
        const u = new URL(window.location.href);
        u.searchParams.set("date", k);
        const qs = u.searchParams.toString();
        window.history.replaceState({}, "", qs ? `${u.pathname}?${qs}${u.hash}` : `${u.pathname}${u.hash}`);
      }
    },
    [athleteId],
  );

  useEffect(() => {
    if (athleteLoading) return;
    if (!athleteId) {
      setVm(null);
      setError("Seleziona un atleta attivo per generare il report bioenergetico.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ athleteId, date });
        const res = await fetch(`/api/bioenergetics/day?${q}`, {
          cache: "no-store",
          credentials: "same-origin",
          headers: await buildSupabaseAuthHeaders(),
        });
        const json = (await res.json()) as BioenergeticsDayViewModel & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setVm(null);
          setError(json.error ?? "Lettura BioEnergetic Intelligence non riuscita.");
          return;
        }
        const cm = json.continuousMonitoring as BioenergeticsDayViewModel["continuousMonitoring"] | undefined;
        const vmPayload: BioenergeticsDayViewModel = {
          ...json,
          series: Array.isArray(json.series) ? json.series : [],
          continuousMonitoring:
            cm && typeof cm === "object" && cm.layer === "model_continuous_v1" && Array.isArray(cm.channels)
              ? cm
              : undefined,
        };
        setVm(vmPayload);
      } catch {
        if (!cancelled) {
          setVm(null);
          setError("Errore di rete durante il caricamento.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [athleteId, athleteLoading, date]);

  /** Solo glucosio/lattato da CGM o lab quel giorno (non include potenza/trace né piano). */
  const measuredGluLacBadge = useMemo(() => {
    if (!vm) return "—";
    const measuredCount = [vm.provenance.glucose, vm.provenance.lactate].filter((p) => p === "measured").length;
    return `${measuredCount}/2`;
  }, [vm]);

  const traceSeriesCount = useMemo(() => {
    if (!vm?.series?.length) return 0;
    const traceIds = new Set(["power_w", "hr_bpm", "speed_kmh", "cadence_rpm", "altitude_m", "temperature_c"]);
    return vm.series.filter((s) => traceIds.has(s.id) && s.provenance === "measured" && s.points.length >= 2).length;
  }, [vm]);

  return (
    <Pro2ModulePageShell
      eyebrow="BioEnergetic Intelligence · Focus"
      eyebrowClassName="text-lime-400"
      title="BioEnergetic Intelligence"
      description="Monitoraggio continuo (modello v1) sulla giornata: timeline training/nutrizione/device, strisce 24 h per analita, pathway supportivo o inibitorio — contratto pronto a integrazione stream device."
      headerActions={
        <>
          <Pro2Link href="/nutrition" variant="secondary" className="justify-center border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15">
            Nutrition
          </Pro2Link>
          <Pro2Link href="/training/calendar" variant="ghost" className="justify-center border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15">
            Calendar
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        <GenerativeModuleSubnav />
      </div>

      <section id="gen-domain" className="scroll-mt-28">
        <Pro2SectionCard accent="emerald" title="Range giornata" subtitle="Seleziona giorno report" icon={Timer}>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDateAndPersist(e.currentTarget.value)}
              className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <p className="max-w-xl text-xs leading-relaxed text-gray-400">
              La data di default segue il <strong className="text-gray-200">giorno piano Nutrizione</strong> (stesso valore in sessionStorage per atleta) oppure{" "}
              <code className="text-gray-300">?date=YYYY-MM-DD</code> nell&apos;URL. Cambiando qui si aggiornano anche Nutrizione e il link condiviso.
            </p>
          </div>
        </Pro2SectionCard>
      </section>

      <section id="gen-body" className="scroll-mt-28 space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-cyan-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-cyan-300">Eventi timeline</p>
            <p className="mt-1 text-xl font-semibold text-white">{vm?.timeline.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-lime-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-lime-300">Glicemia / lattato (CGM o lab)</p>
            <p className="mt-1 text-xl font-semibold text-white">{measuredGluLacBadge}</p>
            <p className="mt-1 text-[0.65rem] leading-snug text-gray-500">
              Serie da trace allenamento:{" "}
              <span className="text-lime-200/90">{traceSeriesCount > 0 ? `${traceSeriesCount} con ≥2 punti` : "nessuna"}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-fuchsia-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-fuchsia-300">Pathway state</p>
            <p className="mt-1 text-xl font-semibold capitalize text-white">{vm?.kernel.pathwayState ?? "—"}</p>
          </div>
        </div>

        {error ? <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</p> : null}
        {athleteLoading || loading ? (
          <div className="space-y-2">
            <div className="h-3 w-full max-w-xl animate-pulse rounded bg-white/10" />
            <div className="h-24 w-full animate-pulse rounded-2xl bg-white/5" />
          </div>
        ) : null}

        {vm && vm.timeline.length === 0 ? (
          <p className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            Per <strong className="text-white">{vm.date}</strong> non risultano ancora eventi in timeline (sessioni pianificate/eseguite nel range, voci diario, export device o lab con
            quella data). I grafici mostrano comunque il modello kernel; per arricchire i dati usa{" "}
            <Pro2Link href="/nutrition/diary" className="text-cyan-200 underline-offset-2 hover:text-white">
              Diario
            </Pro2Link>{" "}
            e{" "}
            <Pro2Link href="/training/calendar" className="text-cyan-200 underline-offset-2 hover:text-white">
              Calendario
            </Pro2Link>{" "}
            con la stessa data.
          </p>
        ) : null}

        {vm ? (
          <>
            <Pro2SectionCard
              accent="fuchsia"
              title="Via metabolica · 24 h"
              subtitle="Monitoraggio continuo (modello): bilancio pathway, glucosio e lattato; fascia = impatto orario. Stesso paradigma UI sostituibile da stream device."
              icon={LineChart}
            >
              <BioenergeticsPathway24Chart data={vm.chart24h ?? []} />
              {vm.continuousMonitoring?.channels?.length ? (
                <div className="mt-6 border-t border-white/10 pt-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fuchsia-200/85">
                    Striscia monitoraggio continuo (24 h)
                  </p>
                  <p className="mb-4 text-[0.7rem] leading-relaxed text-gray-500">
                    Ogni pannello è una serie oraria nello stesso contratto: oggi da modello deterministico o da referto
                    tenuto costante; quando disponibile un device a monitoraggio continuo, le curve nello stesso layout
                    diventano dati reali senza cambiare il ragionamento biochimico sul tempo.
                  </p>
                  <BioenergeticsContinuousMonitoringGrid monitoring={vm.continuousMonitoring} />
                </div>
              ) : null}
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-fuchsia-200/80">Serie da memoria giorno</p>
                <BioenergeticsDaySeriesPanel series={vm.series ?? []} />
              </div>
            </Pro2SectionCard>

            <Pro2SectionCard accent="amber" title="Segnali & biomarker" subtitle="Da lab e canali del giorno; assenza dati non implica valore clinico" icon={LineChart}>
              {(() => {
                const tiles = vm.metricTiles ?? [];
                const byCat = tiles.reduce<Record<string, BioenergeticMetricTile[]>>((acc, t) => {
                  const k = t.category;
                  if (!acc[k]) acc[k] = [];
                  acc[k].push(t);
                  return acc;
                }, {});
                const order: BioenergeticMetricTileCategory[] = [
                  "metabolic",
                  "inflammatory",
                  "hormonal",
                  "neural",
                  "gastro_intestinal",
                  "gonadal",
                ];
                return (
                  <div className="space-y-6">
                    {order.map((cat) => {
                      const list = byCat[cat];
                      if (!list?.length) return null;
                      return (
                        <div key={cat}>
                          <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-wider text-amber-200/90">
                            {CATEGORY_LABEL[cat]}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {list.map((t) => (
                              <div
                                key={t.id}
                                className={`rounded-2xl border px-3 py-2.5 ${impactTileClass(t.impact)}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-medium leading-snug text-white">{t.labelIt}</p>
                                  <span className="shrink-0 rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-gray-400">
                                    {provenanceLabel(t.provenance)}
                                  </span>
                                </div>
                                <p className="mt-1 font-mono text-lg font-semibold text-white">{t.displayValue}</p>
                                <p className="text-[0.65rem] text-gray-500">{t.unit}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Pro2SectionCard>

            <Pro2SectionCard accent="cyan" title="Kernel v1" subtitle="Contrasto domanda energetica vs esposizione CHO" icon={Activity}>
              <p className="text-sm text-gray-300">
                Glucose handling {vm.kernel.glucoseHandlingScore} · Insulin demand {vm.kernel.insulinDemandScore} ·
                Oxidation drive {vm.kernel.oxidationDriveScore}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {vm.kernel.keyDrivers.map((d) => (
                  <span key={d} className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-gray-300">
                    {d}
                  </span>
                ))}
              </div>
            </Pro2SectionCard>
          </>
        ) : null}
      </section>

      <section id="gen-cross" className="scroll-mt-28">
        {vm?.interpretationHints?.length ? (
          <Pro2SectionCard accent="violet" title="Interpretation" subtitle="Hint multiscala (non diagnostici)" icon={LineChart}>
            <div className="space-y-2">
              {vm.interpretationHints.map((h) => (
                <div key={h.pathwayId} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <p className="text-sm font-semibold text-white">{h.title}</p>
                  <p className="text-xs text-gray-400">{h.detail}</p>
                </div>
              ))}
            </div>
          </Pro2SectionCard>
        ) : null}
      </section>

      <section id="gen-focus" className="scroll-mt-28">
        <Pro2SectionCard accent="rose" title="Disclaimers" subtitle="Sicurezza interpretativa" icon={Activity}>
          <ul className="space-y-2 text-sm text-gray-300">
            {(vm?.disclaimers ?? ["Nessuna nota disponibile."]).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Pro2SectionCard>
      </section>
    </Pro2ModulePageShell>
  );
}
