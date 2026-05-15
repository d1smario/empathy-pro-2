"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, LineChart, Timer } from "lucide-react";
import type {
  BioenergeticMetricTile,
  BioenergeticMetricTileCategory,
  BioenergeticPathwayImpact,
  BioenergeticTimelineEvent,
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
import { BioenergeticsStripAuditPanel } from "@/modules/bioenergetics/components/BioenergeticsStripAuditPanel";

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

const TIMELINE_MODEL_TYPES = new Set<BioenergeticTimelineEvent["type"]>(["meal", "planned_session", "executed_session"]);

export default function BioenergeticsPageView() {
  const searchParams = useSearchParams();
  const { athleteId, loading: athleteLoading } = useActiveAthlete();
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vm, setVm] = useState<BioenergeticsDayViewModel | null>(null);
  const seededFromContext = useRef(false);
  const genBodyRef = useRef<HTMLElement | null>(null);

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
        const q = new URLSearchParams({ athleteId, date, stripAudit: "1" });
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
          dayContractVersion: json.dayContractVersion ?? 1,
          canonicalStreamCounts: json.canonicalStreamCounts ?? {
            glucoseSampleCount: 0,
            lactateSampleCount: 0,
          },
          series: Array.isArray(json.series) ? json.series : [],
          evidenceConditionedLayer: json.evidenceConditionedLayer ?? null,
          continuousMonitoring:
            cm &&
            typeof cm === "object" &&
            (cm.layer === "model_continuous_v1" || cm.layer === "ai_from_inputs_v1") &&
            Array.isArray(cm.channels)
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

  const timelineModelStimuli = useMemo(() => {
    if (!vm?.timeline?.length) return [];
    return [...vm.timeline].filter((e) => TIMELINE_MODEL_TYPES.has(e.type)).sort((a, b) => a.ts.localeCompare(b.ts));
  }, [vm?.timeline]);

  return (
    <Pro2ModulePageShell
      eyebrow="BioEnergetic Intelligence · Focus"
      eyebrowClassName="text-lime-400"
      title="BioEnergetic Intelligence"
      description="Striscia 24 h: mattino predittivo da meal plan + training pianificato; pomeriggio-sera adattata a diario e sedute eseguite. Tile metriche da OpenAI sugli stessi input. Non è CGM né referto."
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

      <section id="gen-body" ref={genBodyRef} className="scroll-mt-28 space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-cyan-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-cyan-300">Giorno</p>
            <p className="mt-1 font-mono text-lg font-semibold text-white">{vm?.date ?? "—"}</p>
          </div>
          <div className="rounded-2xl border border-fuchsia-500/25 bg-black/35 px-4 py-3">
            <p className="font-mono text-[0.6rem] uppercase tracking-wider text-fuchsia-300">Eventi timeline</p>
            <p className="mt-1 text-xl font-semibold text-white">{vm?.timeline.length ?? 0}</p>
            <p className="mt-1 text-[0.65rem] text-gray-500">Pasti, sedute, export e lab usati come contesto per OpenAI.</p>
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
            Per <strong className="text-white">{vm.date}</strong> la timeline è vuota: OpenAI riceve meno contesto. Aggiungi pasti in{" "}
            <Pro2Link href="/nutrition/diary" className="text-cyan-200 underline-offset-2 hover:text-white">
              Diario
            </Pro2Link>{" "}
            e sedute in{" "}
            <Pro2Link href="/training/calendar" className="text-cyan-200 underline-offset-2 hover:text-white">
              Calendario
            </Pro2Link>
            .
          </p>
        ) : null}

        {vm ? (
          <>
            <Pro2SectionCard
              accent="amber"
              title="Metabolismo, infiammazione, ormoni e neuromodulatori"
              subtitle="Valori «Stimato» da un’unica generazione OpenAI sulla memoria del giorno (diario, training, timeline)."
              icon={LineChart}
            >
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

            <Pro2SectionCard
              accent="fuchsia"
              title="Striscia 24 h (curve)"
              subtitle="Motore deterministico con fusione piano→realtà; passo 5 min. CGM misurato ha priorità assoluta."
              icon={LineChart}
            >
              {vm.continuousMonitoring &&
              (vm.continuousMonitoring.channels.length > 0 || vm.continuousMonitoring.layer === "ai_from_inputs_v1") ? (
                <div className="space-y-4">
                  {vm.continuousMonitoring.channels.length === 0 &&
                  vm.continuousMonitoring.layer === "ai_from_inputs_v1" ? (
                    <p className="rounded-lg border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-2 text-[0.7rem] leading-relaxed text-fuchsia-100/95">
                      Nessuna curva: verifica <code className="text-fuchsia-200/90">OPENAI_API_KEY</code> e la risposta JSON (vedi disclaimer).
                    </p>
                  ) : null}
                  {timelineModelStimuli.length ? (
                    <div className="rounded-xl border border-fuchsia-500/20 bg-black/35 p-3">
                      <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-fuchsia-200/90">
                        Contesto inviato (estratto timeline)
                      </p>
                      <ul className="max-h-36 space-y-1.5 overflow-y-auto text-[0.7rem] text-gray-200">
                        {timelineModelStimuli.map((e) => (
                          <li
                            key={e.id}
                            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-white/5 pb-1.5 last:border-0 last:pb-0"
                          >
                            <span className="shrink-0 font-mono text-[0.65rem] text-fuchsia-200/90">{e.ts}</span>
                            <span className="shrink-0 text-gray-500">
                              {e.type === "meal"
                                ? "Pasto"
                                : e.type === "executed_session"
                                  ? "Seduta eseguita"
                                  : "Seduta pianificata"}
                            </span>
                            <span className="min-w-0 flex-1 text-gray-100">{e.title}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {vm.continuousMonitoring.channels.length > 0 ? (
                    <BioenergeticsContinuousMonitoringGrid monitoring={vm.continuousMonitoring} />
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Nessun dato striscia per questa giornata.</p>
              )}
            </Pro2SectionCard>

            {vm.planRealityFusionV1 ? (
              <p className="rounded-lg border border-lime-500/25 bg-lime-500/10 px-3 py-2 text-[0.7rem] leading-relaxed text-lime-100/95">
                Adattamento da ore{" "}
                <strong className="text-white">
                  {vm.planRealityFusionV1.adaptFromHour >= 24 ? "— (solo piano)" : vm.planRealityFusionV1.adaptFromHour}
                </strong>
                {" · "}
                piano: {vm.planRealityFusionV1.planSource} ({vm.planRealityFusionV1.plannedMealCount} pasti) · diario:{" "}
                {vm.planRealityFusionV1.diaryMealCount} · eseguite: {vm.planRealityFusionV1.executedSessionCount}
              </p>
            ) : null}

            {vm.monitoringStripAuditV1 ? (
              <BioenergeticsStripAuditPanel audit={vm.monitoringStripAuditV1} />
            ) : null}

          </>
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
