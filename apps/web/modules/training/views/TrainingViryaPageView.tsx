"use client";

import type { KnowledgeResearchTraceSummary } from "@/api/knowledge/contracts";
import type { ResearchPlan } from "@/lib/empathy/schemas/research";
import { Brain, CalendarRange, FlaskConical, LineChart, ScrollText, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TrainingSubnav } from "@/components/training/TrainingSubnav";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";
import { useActiveAthlete } from "@/lib/use-active-athlete";
import { ViryaAnnualPlanOrchestrator } from "@/modules/training/components/ViryaAnnualPlanOrchestrator";
import { fetchTrainingPlannerContext } from "@/modules/training/services/training-virya-api";

function planTriggerLine(p: ResearchPlan): string {
  const t = p.trigger;
  const bits: string[] = [t.kind];
  if (t.stimulusLabel) bits.push(t.stimulusLabel);
  if (t.entityLabel) bits.push(t.entityLabel);
  if (t.adaptationTarget) bits.push(String(t.adaptationTarget));
  return bits.join(" · ");
}

function traceStatusClass(status: KnowledgeResearchTraceSummary["status"]): string {
  switch (status) {
    case "complete":
      return "text-emerald-300";
    case "running":
      return "text-sky-300";
    case "ready":
      return "text-amber-200";
    default:
      return "text-slate-400";
  }
}

/**
 * Virya (V1 parity, shell Pro 2): contesto canonico da `resolveAthleteMemory` + hint strategici.
 * La materializzazione sedute resta sul builder (`/api/training/engine/generate`) e sul calendario.
 */
export default function TrainingViryaPageView() {
  const { athleteId, loading: ctxLoading } = useActiveAthlete();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof fetchTrainingPlannerContext>> | null>(null);

  const load = useCallback(async () => {
    if (ctxLoading) return;
    if (!athleteId) {
      setCtx(null);
      setErr("Nessun atleta attivo.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const vm = await fetchTrainingPlannerContext(athleteId);
      if (vm.error) {
        setErr(vm.error);
      } else {
        setErr(null);
      }
      setCtx(vm);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Caricamento contesto non riuscito.");
      setCtx(null);
    } finally {
      setLoading(false);
    }
  }, [athleteId, ctxLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const phys = ctx?.physiology as Record<string, unknown> | null | undefined;
  const ftp = phys && typeof phys.ftp_watts === "number" ? phys.ftp_watts : null;

  const flagsList = useMemo(() => {
    if (!ctx?.flags) return [];
    return Object.entries(ctx.flags).filter(([, v]) => v === true);
  }, [ctx?.flags]);

  return (
    <Pro2ModulePageShell
      eyebrow="Training · Virya"
      eyebrowClassName="text-violet-400"
      title="Virya · contesto e piano annuale"
      description="Contesto canonico (fisiologia, hint, research) e orchestratore annuale: fasi, TSS, deploy su Calendar tramite lo stesso motore sessione del builder."
      headerActions={
        <>
          <Pro2Link
            href="/training"
            variant="ghost"
            className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:border-cyan-400/50 hover:bg-cyan-500/15"
          >
            Hub
          </Pro2Link>
          <Pro2Link
            href="/training/calendar"
            variant="ghost"
            className="justify-center border border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15"
          >
            Calendar
          </Pro2Link>
          <Pro2Link
            href="/training/builder"
            variant="secondary"
            className="justify-center border border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15"
          >
            Builder
          </Pro2Link>
          <Pro2Link
            href="/nutrition"
            variant="ghost"
            className="justify-center border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15"
          >
            Nutrition
          </Pro2Link>
        </>
      }
    >
      <div className="scroll-mt-28">
        <TrainingSubnav />
      </div>

      {err ? (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
          {err}
        </p>
      ) : null}

      {loading || ctxLoading ? (
        <div className="mb-6 space-y-2">
          <div className="h-3 w-full max-w-xl animate-pulse rounded-lg bg-violet-500/15" />
          <div className="h-40 w-full animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : null}

      {!loading && !ctxLoading && ctx ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Pro2SectionCard accent="violet" title="Fisiologia · sintesi" subtitle="Da memoria atleta canonica" icon={Sparkles}>
            <dl className="grid gap-2 text-sm text-slate-300">
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <dt className="text-slate-500">FTP</dt>
                <dd className="font-mono tabular-nums text-white">{ftp != null ? `${Math.round(ftp)} W` : "—"}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                <dt className="text-slate-500">Moduli collegati</dt>
                <dd className="text-right text-xs text-slate-400">
                  Profilo {ctx.connectedModules?.profile ? "sì" : "no"} · Fisiologia{" "}
                  {ctx.connectedModules?.physiology ? "sì" : "no"} · Salute {ctx.connectedModules?.health ? "sì" : "no"}
                </dd>
              </div>
              {ctx.operationalContext ? (
                <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-slate-400">
                  <p className="font-semibold text-violet-200/90">Contesto operativo giorno</p>
                  <p className="mt-1">{ctx.operationalContext.headline}</p>
                  <p className="mt-1 opacity-90">{ctx.operationalContext.guidance}</p>
                  <p className="mt-2 font-mono text-[0.65rem] text-slate-500">
                    scala carico {Math.round(ctx.operationalContext.loadScalePct)}% · modo {ctx.operationalContext.mode}
                  </p>
                </div>
              ) : null}
            </dl>
          </Pro2SectionCard>

          <Pro2SectionCard accent="amber" title="Strategia · hint" subtitle="Flags + derive V1" icon={Brain}>
            <div className="flex flex-wrap gap-2">
              {(ctx.strategyHints ?? []).map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-amber-400/35 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-100"
                >
                  {h}
                </span>
              ))}
            </div>
            {flagsList.length ? (
              <div className="mt-4">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Flags attivi</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-200/90">
                  {flagsList.map(([k]) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Nessun flag di vincolo attivo.</p>
            )}
          </Pro2SectionCard>

          {ctx.adaptationLoop ? (
            <Pro2SectionCard accent="cyan" title="Adattamento · loop" subtitle="7–28g pianificato vs eseguito" icon={LineChart}>
              <dl className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Stato</dt>
                  <dd className="font-semibold text-cyan-100">{ctx.adaptationLoop.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Compliance</dt>
                  <dd className="font-mono">{ctx.adaptationLoop.executionCompliancePct.toFixed(0)}%</dd>
                </div>
                <p className="text-xs text-slate-500">{ctx.adaptationLoop.guidance}</p>
              </dl>
            </Pro2SectionCard>
          ) : null}

          {ctx.bioenergeticModulation ? (
            <Pro2SectionCard accent="fuchsia" title="Bioenergetica" subtitle="Modulazione carico" icon={CalendarRange}>
              <p className="text-sm text-slate-300">{ctx.bioenergeticModulation.headline}</p>
              <p className="mt-2 text-xs text-slate-500">{ctx.bioenergeticModulation.guidance}</p>
              <p className="mt-2 font-mono text-[0.65rem] text-slate-500">
                scala {Math.round(ctx.bioenergeticModulation.loadScalePct)}% · {ctx.bioenergeticModulation.state}
              </p>
            </Pro2SectionCard>
          ) : null}

          {ctx.knowledgeModulation ? (
            <Pro2SectionCard accent="emerald" title="Knowledge · modulazione attiva" subtitle="Dominio training/bio/nutrition da memoria" icon={ScrollText}>
              <dl className="space-y-2 text-sm text-slate-300">
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-slate-500">Dominio</dt>
                  <dd className="font-semibold text-emerald-100">{ctx.knowledgeModulation.domain}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-slate-500">Vincolo</dt>
                  <dd className="text-right text-xs">{ctx.knowledgeModulation.constraintLevel}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-white/10 pb-2">
                  <dt className="text-slate-500">Confidenza</dt>
                  <dd className="font-mono tabular-nums">{(ctx.knowledgeModulation.confidence * 100).toFixed(0)}%</dd>
                </div>
                {ctx.knowledgeModulation.reasoningSummary ? (
                  <p className="text-xs leading-relaxed text-slate-400">{ctx.knowledgeModulation.reasoningSummary}</p>
                ) : null}
                {ctx.knowledgeModulation.hardConstraints?.length ? (
                  <div>
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-rose-300/80">Hard</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-rose-100/80">
                      {ctx.knowledgeModulation.hardConstraints.slice(0, 8).map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </dl>
            </Pro2SectionCard>
          ) : null}

          {(ctx.researchPlans?.length ?? 0) > 0 ? (
            <Pro2SectionCard accent="cyan" title="Research plans (Virya)" subtitle="Generati dagli hint · persistenza knowledge canonica" icon={FlaskConical}>
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {(ctx.researchPlans ?? []).map((p) => (
                  <li key={p.planId} className="rounded-xl border border-cyan-500/20 bg-black/35 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[0.65rem] text-slate-500">{p.planId.slice(0, 10)}…</span>
                      <span className="rounded-full border border-cyan-400/30 px-2 py-0.5 text-[0.65rem] text-cyan-200">
                        {p.status}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-200">{planTriggerLine(p)}</p>
                    <p className="mt-1 text-slate-500">
                      {p.intents.length} intent · {p.hops.length} hop
                    </p>
                  </li>
                ))}
              </ul>
            </Pro2SectionCard>
          ) : null}

          {(ctx.researchTraces?.length ?? 0) > 0 ? (
            <Pro2SectionCard accent="orange" title="Trace salvati (canonical)" subtitle="Stato hop / link documenti dopo persistenza" icon={FlaskConical}>
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {(ctx.researchTraces ?? []).map((t: KnowledgeResearchTraceSummary) => (
                  <li key={t.traceId} className="rounded-xl border border-orange-500/25 bg-black/35 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[0.65rem] text-slate-500">{t.traceId.slice(0, 10)}…</span>
                      <span className={`font-semibold ${traceStatusClass(t.status)}`}>{t.status}</span>
                    </div>
                    <p className="mt-1 text-slate-400">
                      Hop: {t.hopCounts.complete}/{t.hopCounts.total} completati · doc {t.linkCounts.documents} ·
                      asserzioni {t.linkCounts.assertions}
                    </p>
                    {t.latestResultSummary ? (
                      <p className="mt-1 text-slate-300">{t.latestResultSummary}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Pro2SectionCard>
          ) : null}
        </div>
      ) : null}

      {athleteId ? (
        <ViryaAnnualPlanOrchestrator
          athleteId={athleteId}
          viryaContext={ctx}
          contextLoading={loading || ctxLoading}
        />
      ) : null}

      <Pro2SectionCard accent="orange" title="Pipeline" subtitle="Riepilogo" icon={Sparkles} className="mt-8">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-400">
          <li>Builder = generazione singola sessione; Virya = batch annuale che chiama lo stesso endpoint engine.</li>
          <li>Research plans/trace restano knowledge — non sostituiscono il motore deterministico.</li>
        </ol>
      </Pro2SectionCard>
    </Pro2ModulePageShell>
  );
}
