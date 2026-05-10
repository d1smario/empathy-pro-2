"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, BookOpen, LineChart, Timer } from "lucide-react";
import type {
  BioenergeticBiaLiteratureSummaryV1,
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

function biaCellularBandIt(b: BioenergeticBiaLiteratureSummaryV1["cellularGeometry"]["band"]): string {
  if (b === "low_support_cue") return "Geometria cellulare: segnale basso (letteratura)";
  if (b === "mid") return "Geometria cellulare: intermedio";
  if (b === "favourable_geometry_cue") return "Geometria cellulare: segnale favorevole (contesto)";
  return "Geometria cellulare: dati insufficienti";
}

function biaFluidBandIt(b: BioenergeticBiaLiteratureSummaryV1["extracellularFluid"]["band"]): string {
  if (b === "favourable_balance") return "ECW vs TBW: bilanciamento favorevole";
  if (b === "neutral") return "ECW vs TBW: neutro";
  if (b === "extracellular_shift_cue") return "ECW vs TBW: spostamento extracellulare (letteratura)";
  return "ECW vs TBW: dati insufficienti";
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
          evidenceConditionedLayer: json.evidenceConditionedLayer ?? null,
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

  const resolvedEvidenceLinks = vm?.evidenceConditionedLayer?.resolvedEvidenceLinks ?? [];
  const evidenceLinkCount = resolvedEvidenceLinks.length;

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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          <div className="rounded-2xl border border-orange-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-orange-300">Link evidenza assi ↔ fluidi</p>
            <p className="mt-1 text-xl font-semibold text-white">{vm ? evidenceLinkCount : "—"}</p>
            <p className="mt-1 text-[0.65rem] leading-snug text-gray-500">
              Da DB curato <span className="text-orange-200/90">051 + 052</span>; non è modello curva giornaliera.
            </p>
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
                    Solo glucosio, lattato, domanda insulinica (da diario + sedute), cortisolo e ACTH: niente curve
                    «tutte uguali» per riempire. Gli altri biomarker restano nelle tile finché non c&apos;è un modello
                    serio legato a timeline e fisiologia.
                  </p>
                  <BioenergeticsContinuousMonitoringGrid monitoring={vm.continuousMonitoring} />
                </div>
              ) : null}
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-fuchsia-200/80">Serie da memoria giorno</p>
                <BioenergeticsDaySeriesPanel series={vm.series ?? []} />
              </div>
            </Pro2SectionCard>

            {vm.biaLiteratureSummary ? (
              <Pro2SectionCard
                accent="violet"
                title="BIA · modello letteratura (v1)"
                subtitle={`Prior deterministico · confidenza ${Math.round(vm.biaLiteratureSummary.confidence01 * 100)}% · non diagnosi clinica`}
                icon={Activity}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-violet-200/90">Geometria (PhA)</p>
                    <p className="mt-1 text-sm text-white">{biaCellularBandIt(vm.biaLiteratureSummary.cellularGeometry.band)}</p>
                    <p className="mt-1 font-mono text-xs text-gray-400">
                      supportIndex01={vm.biaLiteratureSummary.cellularGeometry.supportIndex01.toFixed(2)}
                      {vm.biaLiteratureSummary.cellularGeometry.phaseAngleDegUsed != null
                        ? ` · PhA ${vm.biaLiteratureSummary.cellularGeometry.phaseAngleDegUsed.toFixed(1)}°`
                        : null}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-orange-200/90">Comparti fluidi (ECW/TBW)</p>
                    <p className="mt-1 text-sm text-white">{biaFluidBandIt(vm.biaLiteratureSummary.extracellularFluid.band)}</p>
                    <p className="mt-1 font-mono text-xs text-gray-400">
                      loadBias01={vm.biaLiteratureSummary.extracellularFluid.loadBias01.toFixed(2)}
                      {vm.biaLiteratureSummary.extracellularFluid.ecwTbwRatioUsed != null
                        ? ` · ratio ${vm.biaLiteratureSummary.extracellularFluid.ecwTbwRatioUsed.toFixed(3)}`
                        : null}
                    </p>
                  </div>
                </div>
                <details className="mt-4 text-xs text-gray-400">
                  <summary className="cursor-pointer text-violet-200/90">Disclaimer e ancore metodologiche</summary>
                  <ul className="mt-2 space-y-2">
                    {vm.biaLiteratureSummary.disclaimersIt.map((d) => (
                      <li key={d} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-gray-300">
                        {d}
                      </li>
                    ))}
                    {vm.biaLiteratureSummary.literatureAnchorsIt.map((a) => (
                      <li key={a} className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-2 py-1.5 text-gray-300">
                        {a}
                      </li>
                    ))}
                  </ul>
                </details>
              </Pro2SectionCard>
            ) : null}

            {vm.evidenceConditionedLayer && evidenceLinkCount > 0 ? (
              <Pro2SectionCard
                accent="orange"
                title="Evidenza letteratura · assi e fluidi"
                subtitle={`Banco ${vm.evidenceConditionedLayer.bankRef.bankId} · ${vm.evidenceConditionedLayer.bankRef.bankVersion} · ${evidenceLinkCount} link`}
                icon={BookOpen}
              >
                <p className="text-sm leading-relaxed text-gray-300">
                  Grafo curato (ormoni / neuro / renale ↔ processi di fluido). Serve al synthesizer evidenza e alla UI
                  «perché»; le curve sopra restano kernel / misura.
                </p>
                <ul className="mt-3 space-y-2 text-xs text-gray-400">
                  {vm.evidenceConditionedLayer.disclaimersIt.map((d) => (
                    <li key={d} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-gray-300">
                      {d}
                    </li>
                  ))}
                </ul>
                {vm.evidenceConditionedLayer.series.length > 0 ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-orange-200/85">
                      Serie evidenza condizionata (24 h, indice 0–100)
                    </p>
                    <ul className="mt-2 space-y-2">
                      {vm.evidenceConditionedLayer.series.map((s) => {
                        const lo = Math.min(...s.hourlyMean24);
                        const hi = Math.max(...s.hourlyMean24);
                        return (
                          <li
                            key={s.analyteId}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs text-gray-300"
                          >
                            <span className="font-mono text-orange-200/90">{s.analyteId}</span> · {s.unit} · fascia{" "}
                            {lo.toFixed(1)}–{hi.toFixed(1)}
                            <span className="mt-1 block truncate font-mono text-[0.6rem] text-gray-500">
                              digest contesto {s.contextDigest.slice(0, 14)}…
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {vm.evidenceConditionedLayer.contributionGraph ? (
                  <details className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium text-orange-200/90">
                      Grafo contributi ({vm.evidenceConditionedLayer.contributionGraph.edges.length} archi,{" "}
                      {vm.evidenceConditionedLayer.contributionGraph.nodes.length} nodi)
                    </summary>
                    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-[0.65rem] text-gray-500">
                      {vm.evidenceConditionedLayer.contributionGraph.edges.map((e, i) => (
                        <li key={`${e.from}-${e.to}-${i}`} className="font-mono">
                          {e.from} → {e.to}
                          {e.weight01 != null ? ` · w ${e.weight01.toFixed(2)}` : ""}
                          {e.evidenceLinkId ? ` · link ${e.evidenceLinkId.slice(0, 8)}…` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <details className="mt-4 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium text-orange-200/95">
                    Mostra link ({evidenceLinkCount})
                  </summary>
                  <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1">
                    {resolvedEvidenceLinks.map((lk) => (
                      <li key={lk.linkId} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                        <p className="text-[0.65rem] font-mono uppercase tracking-wide text-orange-300/90">
                          {lk.axis.labelIt} → {lk.fluidProcess.labelIt}
                        </p>
                        <p className="mt-1 text-[0.7rem] text-gray-500">
                          {lk.relationKind} · {lk.strength}
                          {lk.ontologyRefs?.length ? ` · ontology ${lk.ontologyRefs.length}` : null}
                        </p>
                        <p className="mt-1 text-xs leading-snug text-gray-300">{lk.narrativeIt}</p>
                        {lk.documents.length ? (
                          <p className="mt-1 text-[0.65rem] text-gray-500">
                            Fonti:{" "}
                            {lk.documents
                              .map((doc) => `${doc.sourceDb}:${doc.externalId}`)
                              .slice(0, 4)
                              .join(" · ")}
                            {lk.documents.length > 4 ? ` · +${lk.documents.length - 4}` : ""}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              </Pro2SectionCard>
            ) : vm ? (
              <Pro2SectionCard accent="slate" title="Evidenza letteratura · assi e fluidi" subtitle="Nessun link caricato" icon={BookOpen}>
                <p className="text-sm text-gray-400">
                  Il layer opzionale è vuoto se le migrazioni <code className="text-gray-300">051</code> /{" "}
                  <code className="text-gray-300">052</code> non sono sul progetto Supabase collegato, oppure se la query fallisce
                  (permessi). Con seed applicato dovresti vedere <strong className="text-white">8</strong> link e la tile arancione con
                  conteggio.
                </p>
              </Pro2SectionCard>
            ) : null}

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
