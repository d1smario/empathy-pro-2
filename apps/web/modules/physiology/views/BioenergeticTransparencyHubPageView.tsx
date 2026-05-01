"use client";

import { useEffect, useMemo, useState } from "react";
import { buildInfluenceLedgerRowsFromOperationalBundle } from "@/lib/platform/bioenergetic-transparency-ledger";
import type { BioenergeticInfluenceLedgerRow } from "@/lib/platform/bioenergetic-transparency-ledger";
import { useAthleteOperationalHub } from "@/lib/dashboard/use-athlete-operational-hub";
import type { OperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import type { ReasoningCardVm, ReasoningDashboardErr, ReasoningDashboardOk, ReasoningTone } from "@/lib/dashboard/reasoning-dashboard-contract";
import { reasoningDashboardUrl } from "@/lib/dashboard/reasoning-dashboard-contract";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Link } from "@/components/ui/empathy";
import { buildSupabaseAuthHeaders } from "@/lib/auth/client-session";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";

type BioTone = ReasoningTone;

type BioCellVm = {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: BioTone;
  detail: string;
};

function fixed(value: number | null | undefined, digits = 1): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function rounded(value: number | null | undefined, suffix = ""): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}${suffix}` : "—";
}

function percent(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

function compactAction(action: string): string {
  return action.replaceAll("_", " ");
}

function toneForLoop(status: string): BioTone {
  if (status === "regenerate") return "rose";
  if (status === "watch") return "amber";
  return "green";
}

function buildBioenergetisCells(sig: OperationalSignalsBundle): BioCellVm[] {
  const g = sig.adaptationGuidance;
  const loop = sig.adaptationLoop;
  const bio = sig.bioenergeticModulation;
  const nut = sig.nutritionPerformanceIntegration;
  const ctx = sig.operationalContext;

  return [
    {
      id: "adaptation-score",
      label: "Adattamento",
      value: `${g.scorePct}%`,
      sub: `${fixed(g.expectedAdaptation, 2)} atteso · ${fixed(g.observedAdaptation, 2)} osservato`,
      tone: g.trafficLight === "red" ? "rose" : g.trafficLight === "yellow" ? "amber" : "green",
      detail: `Semaforo ${g.trafficLight}. Il numero confronta adattamento atteso e osservato dal twin; non genera piano, alimenta il loop operativo.`,
    },
    {
      id: "loop-divergence",
      label: "Loop",
      value: fixed(loop.divergenceScore, 1),
      sub: `${loop.status} · ${compactAction(loop.nextAction)}`,
      tone: toneForLoop(loop.status),
      detail: `Planned ${rounded(loop.expectedLoad7d)} · real ${rounded(loop.realLoad7d)} · internal ${rounded(loop.internalLoad7d)}. Compliance ${percent(loop.executionCompliancePct)}.`,
    },
    {
      id: "bio-load",
      label: "Scala carico",
      value: bio ? `${bio.loadScale.toFixed(2)}x` : "—",
      sub: bio ? `${percent(bio.loadScalePct)} · ${bio.state}` : "fisiologia/twin parziali",
      tone: bio?.state === "protective" ? "rose" : bio?.state === "watch" ? "amber" : bio ? "cyan" : "slate",
      detail: bio
        ? `${bio.headline} ${bio.guidance} Copertura segnali ${percent(bio.signalCoveragePct)}, incertezza ±${percent(bio.inputUncertaintyPct)}.`
        : "Modulazione non calcolata: servono fisiologia e twin nello stesso bundle operativo.",
    },
    {
      id: "readiness",
      label: "Readiness",
      value: rounded(loop.readinessScore, "/100"),
      sub: `adapt ${rounded(loop.adaptationScore, "/100")} · intervention ${fixed(loop.interventionScore, 1)}`,
      tone: loop.readinessScore < 45 || loop.interventionScore > 40 ? "amber" : "violet",
      detail: `Readiness e intervention score guidano la cautela del giorno. Trigger attivi: ${loop.triggers.length ? loop.triggers.join(" · ") : "nessuno"}.`,
    },
    {
      id: "nutrition-dials",
      label: "Fueling dial",
      value: `${nut.fuelingChoScale.toFixed(2)}x`,
      sub: `E ${nut.trainingEnergyScale.toFixed(2)}x · protein +${nut.proteinBiasPctPoints.toFixed(1)} pt`,
      tone: "cyan",
      detail: `Idratazione floor ${nut.hydrationFloorMultiplier.toFixed(2)}x. Le leve scalano solver nutrizione/fueling a partire dagli stessi segnali compute.`,
    },
    {
      id: "day-context",
      label: "Giornata",
      value: ctx ? percent(ctx.loadScalePct ?? ctx.loadScale * 100) : "—",
      sub: ctx ? `${ctx.mode} · ${ctx.headline}` : "contesto assente",
      tone: ctx ? (ctx.loadScalePct < 90 ? "amber" : "green") : "slate",
      detail: ctx
        ? `${ctx.guidance} Questo contesto viene consumato da VIRYA e dai dial applicativi, non dalla UI come motore parallelo.`
        : "Nessun contesto operativo giornata disponibile.",
    },
  ];
}

function BioKpiGrid({ cells }: { cells: BioCellVm[] }) {
  return (
    <div className="fueling-main-kpi-grid" style={{ marginBottom: 12 }}>
      {cells.map((cell) => (
        <article key={cell.id} className={`fueling-main-kpi-card fueling-main-kpi-card--${cell.tone}`}>
          <div className="fueling-main-kpi-label">{cell.label}</div>
          <div className="fueling-main-kpi-value">{cell.value}</div>
          <div className="fueling-main-kpi-sub">{cell.sub}</div>
          <details className="collapsible-card mt-3 border-white/10 bg-black/20 px-2.5 py-2">
            <summary className="text-[0.62rem]">Perché</summary>
            <p className="m-0 text-[0.72rem] leading-relaxed text-slate-400">{cell.detail}</p>
          </details>
        </article>
      ))}
    </div>
  );
}

function LedgerCellStrip({ rows }: { rows: BioenergeticInfluenceLedgerRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
      {rows.map((row, index) => {
        const tone: BioTone = (["green", "amber", "cyan", "violet", "rose", "slate"] as const)[index % 6];
        return (
          <details
            key={row.id}
            className={`collapsible-card min-w-[16rem] shrink-0 border-white/10 bg-black/30 fueling-main-kpi-card--${tone}`}
          >
            <summary className="text-[0.65rem]">{row.source}</summary>
            <div className="space-y-2 text-xs leading-relaxed text-slate-400">
              <p className="m-0">
                <span className="font-semibold text-slate-200">Consumatore:</span> {row.consumer}
              </p>
              <p className="m-0">
                <span className="font-semibold text-slate-200">Effetto:</span> {row.effect}
              </p>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function reasoningToneClass(tone: ReasoningTone): string {
  switch (tone) {
    case "green":
      return "fueling-main-kpi-card--green border-emerald-500/25";
    case "amber":
      return "fueling-main-kpi-card--amber border-amber-500/25";
    case "cyan":
      return "fueling-main-kpi-card--cyan border-cyan-500/25";
    case "violet":
      return "fueling-main-kpi-card--violet border-violet-500/25";
    case "rose":
      return "fueling-main-kpi-card--rose border-rose-500/25";
    default:
      return "fueling-main-kpi-card--slate border-white/10";
  }
}

function ReasoningDashboardPanel({
  data,
  loading,
  error,
  busyRun,
  onPatchRun,
}: {
  data: ReasoningDashboardOk | null;
  loading: boolean;
  error: string | null;
  busyRun: string | null;
  onPatchRun: (runId: string, status: "committed" | "rejected" | "archived") => void;
}) {
  const cards = data?.cards ?? [];
  return (
    <section className="viz-card builder-panel space-y-4" style={{ marginBottom: 12 }}>
      <header>
        <h2 className="viz-title">Reasoning Dashboard</h2>
        <p className="mt-1 text-sm text-gray-400">
          Ragionamenti cross-modulo: training, VIRYA, nutrition, redox, microbiota, epigenetica, ematico e timing. Le azioni restano in
          staging fino a validazione.
        </p>
      </header>
      {loading ? <div className="h-2 w-48 animate-pulse rounded-full bg-white/10" aria-hidden /> : null}
      {error ? <p className="text-sm text-amber-300/90">{error}</p> : null}
      {data ? (
        <div className="fueling-main-kpi-grid" style={{ marginBottom: 10 }}>
          {[
            { label: "Totale", value: data.summary.total, tone: "cyan" as const },
            { label: "Pending", value: data.summary.pending, tone: "amber" as const },
            { label: "Validati", value: data.summary.committed, tone: "green" as const },
            { label: "Scartati", value: data.summary.rejected + data.summary.archived, tone: "slate" as const },
          ].map((item) => (
            <div key={item.label} className={`fueling-main-kpi-card fueling-main-kpi-card--${item.tone}`}>
              <div className="fueling-main-kpi-label">{item.label}</div>
              <div className="fueling-main-kpi-value">{item.value}</div>
              <div className="fueling-main-kpi-sub">Decisioni ragionate</div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {cards.slice(0, 12).map((card) => (
          <article key={card.id} className={`rounded-2xl border bg-black/30 p-4 ${reasoningToneClass(card.tone)}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[0.62rem] font-bold uppercase tracking-wider text-slate-500">
                  {card.domain} · {card.status}
                </div>
                <h3 className="mt-1 text-sm font-bold text-white">{card.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{card.subtitle}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-2xl font-black tabular-nums text-white">{card.value}</div>
                <div className="text-[0.62rem] text-slate-500">
                  conf {card.confidence != null ? `${Math.round(card.confidence * 100)}%` : "n/d"}
                </div>
              </div>
            </div>
            <details className="collapsible-card mt-3 border-white/10 bg-black/25">
              <summary>Spiegazione</summary>
              <div className="space-y-3 text-xs leading-relaxed text-slate-400">
                <p className="m-0">{card.explanation}</p>
                {card.actionLines.length ? (
                  <div>
                    <div className="font-semibold text-slate-200">Azioni</div>
                    <ul className="m-0 list-disc pl-4">
                      {card.actionLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {card.evidenceLines.length ? (
                  <div>
                    <div className="font-semibold text-slate-200">Evidenza / trace</div>
                    <ul className="m-0 list-disc pl-4">
                      {card.evidenceLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {card.riskLines.length ? (
                  <div>
                    <div className="font-semibold text-amber-100">Rischi / cautela</div>
                    <ul className="m-0 list-disc pl-4">
                      {card.riskLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {card.timingLines.length ? (
                  <div>
                    <div className="font-semibold text-cyan-100">Timing</div>
                    <ul className="m-0 list-disc pl-4">
                      {card.timingLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {card.sourceRefs.length ? (
                  <div className="font-mono text-[0.62rem] text-slate-600">
                    Source refs: {card.sourceRefs.map((ref) => [ref.table ?? ref.kind, ref.id ?? ref.label].filter(Boolean).join(":")).join(" · ")}
                  </div>
                ) : null}
              </div>
            </details>
            {card.stagingRunId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { status: "committed" as const, label: "Valida" },
                  { status: "rejected" as const, label: "Scarta" },
                  { status: "archived" as const, label: "Archivia" },
                ].map((action) => {
                  const busy = busyRun === `${card.stagingRunId}:${action.status}`;
                  return (
                    <button
                      key={action.status}
                      type="button"
                      disabled={Boolean(busyRun)}
                      onClick={() => card.stagingRunId && onPatchRun(card.stagingRunId, action.status)}
                      className="rounded-md border border-white/10 bg-black/35 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-100 transition hover:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "..." : action.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </article>
        ))}
      </div>
      {!loading && !error && !cards.length ? <p className="text-xs text-slate-500">Nessun ragionamento disponibile.</p> : null}
    </section>
  );
}

export default function BioenergeticTransparencyHubPageView() {
  const { athleteId, ctxLoading, loading, error: err, hub, refetch } = useAthleteOperationalHub();
  const [reasoning, setReasoning] = useState<ReasoningDashboardOk | null>(null);
  const [reasoningLoading, setReasoningLoading] = useState(false);
  const [reasoningErr, setReasoningErr] = useState<string | null>(null);
  const [reasoningBusyRun, setReasoningBusyRun] = useState<string | null>(null);
  const showLoading = ctxLoading || loading;
  const ledger = useMemo(
    () => buildInfluenceLedgerRowsFromOperationalBundle(hub?.operationalSignals ?? null),
    [hub?.operationalSignals],
  );

  const sig = hub?.operationalSignals;
  const cells = useMemo(() => (sig ? buildBioenergetisCells(sig) : []), [sig]);

  async function loadReasoning() {
    if (!athleteId) {
      setReasoning(null);
      setReasoningErr("Nessun atleta attivo.");
      setReasoningLoading(false);
      return;
    }
    setReasoningLoading(true);
    setReasoningErr(null);
    try {
      const res = await fetch(reasoningDashboardUrl(athleteId), {
        cache: "no-store",
        headers: await buildSupabaseAuthHeaders(),
      });
      const json = (await res.json()) as ReasoningDashboardOk | ReasoningDashboardErr;
      if (!res.ok || !json.ok) {
        setReasoning(null);
        setReasoningErr(("error" in json && json.error) || "Reasoning non disponibile.");
        return;
      }
      setReasoning(json);
    } catch {
      setReasoning(null);
      setReasoningErr("Errore rete reasoning.");
    } finally {
      setReasoningLoading(false);
    }
  }

  async function patchReasoningRun(runId: string, status: "committed" | "rejected" | "archived") {
    setReasoningBusyRun(`${runId}:${status}`);
    setReasoningErr(null);
    try {
      const headers = await buildSupabaseAuthHeaders({ "Content-Type": "application/json" });
      const res = await fetch(`/api/health/staging-runs/${encodeURIComponent(runId)}`, {
        method: "PATCH",
        cache: "no-store",
        headers,
        body: JSON.stringify({ status, reason: `Reasoning Dashboard · ${status}` }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setReasoningErr(json.error || "Aggiornamento staging fallito.");
        return;
      }
      await Promise.all([loadReasoning(), refetch()]);
    } catch {
      setReasoningErr("Errore rete aggiornamento staging.");
    } finally {
      setReasoningBusyRun(null);
    }
  }

  useEffect(() => {
    if (ctxLoading || !athleteId) return;
    void loadReasoning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athleteId, ctxLoading]);

  return (
    <Pro2ModulePageShell
      eyebrow="Physiology · Trasparenza operativa"
      eyebrowClassName={moduleEyebrowClass("physiology")}
      title="Bioenergetis"
      description={
        <>
          Vista <strong className="text-emerald-200/90">solo lettura</strong> sullo stesso bundle di Compute usato da dashboard e nutrizione
          (`resolveOperationalSignalsBundle`). Ordine causale: realtà del giorno → segnali → VIRYA (ritune piano) → builder (sessione). Dettaglio
          normativo:{" "}
          <span className="font-mono text-[0.7rem] text-slate-500">
            docs/EMPATHY_PRO2_BIOENERGETIC_TRANSPARENCY_HUB_AND_VIRYA_LOOP.md
          </span>
        </>
      }
      headerActions={
        <>
          <Pro2Link
            href="/dashboard"
            variant="secondary"
            className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
          >
            Dashboard
          </Pro2Link>
          <Pro2Link
            href="/physiology"
            variant="secondary"
            className="justify-center border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15"
          >
            Metabolic Lab
          </Pro2Link>
          <Pro2Link
            href="/training/vyria"
            variant="secondary"
            className="justify-center border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15"
          >
            VIRYA
          </Pro2Link>
          <Pro2Link
            href="/training/builder"
            variant="secondary"
            className="justify-center border border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15"
          >
            Builder
          </Pro2Link>
          <Pro2Link
            href="/nutrition"
            variant="secondary"
            className="justify-center border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15"
          >
            Nutrition
          </Pro2Link>
        </>
      }
    >
      <div className="space-y-8">
        {showLoading ? (
          <div className="h-2 w-56 animate-pulse rounded-full bg-white/10" aria-hidden />
        ) : null}

        {!showLoading && err ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100" role="alert">
            {err}
          </div>
        ) : null}

        {!showLoading && !err && hub ? (
          <>
            <ReasoningDashboardPanel
              data={reasoning}
              loading={reasoningLoading}
              error={reasoningErr}
              busyRun={reasoningBusyRun}
              onPatchRun={patchReasoningRun}
            />

            {sig ? (
              <section className="viz-card builder-panel space-y-4" style={{ marginBottom: 12 }}>
                <header>
                  <h2 className="viz-title">Bioenergetis Stack</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Celle operative dal bundle Compute: twin, loop, scala carico e dial nutrizione. Ogni numero apre la spiegazione.
                  </p>
                </header>
                <details className="collapsible-card" style={{ marginBottom: 10 }}>
                  <summary>Pipeline canonica · Compute → Application</summary>
                  <ol className="m-0 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-slate-400">
                    <li>Realtà del giorno e memoria atleta alimentano il bundle operativo.</li>
                    <li>VIRYA consuma loop, divergenza e contesto per ritunare il microciclo.</li>
                    <li>Builder materializza la singola sessione; non sostituisce VIRYA sul programma macro.</li>
                    <li>Nutrizione/fueling scalano solver e timing a partire dagli stessi segnali.</li>
                  </ol>
                </details>
                <BioKpiGrid cells={cells} />
                {sig.nutritionPerformanceIntegration.rationale.length > 0 ? (
                  <details className="collapsible-card" style={{ marginBottom: 10, borderColor: "rgba(56,189,248,0.35)" }}>
                    <summary className="text-[0.7rem] font-bold uppercase tracking-wider text-cyan-200/90">
                      Leve solver nutrizione ({sig.nutritionPerformanceIntegration.rationale.length})
                    </summary>
                    <ul className="m-0 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-400">
                      {sig.nutritionPerformanceIntegration.rationale.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </section>
            ) : (
              <p className="text-sm text-gray-500">
                Bioenergetis non disponibile (memoria atleta assente o errore nel bundle). Verifica dati twin/fisiologia e riprova.
              </p>
            )}

            {ledger.length > 0 ? (
              <section className="viz-card builder-panel space-y-3" style={{ marginBottom: 12 }}>
                <header>
                  <h2 className="viz-title">Influence Ledger</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Celle audit derivate deterministicamente dal bundle — nessuna scrittura DB da questa pagina.
                  </p>
                </header>
                <LedgerCellStrip rows={ledger} />
              </section>
            ) : null}

            {hub.crossModuleDynamicsLines.length > 0 ? (
              <details className="collapsible-card border-cyan-500/25 bg-cyan-950/10">
                <summary>Dinamica incrociata · training ↔ nutrizione ({hub.crossModuleDynamicsLines.length})</summary>
                <ul className="m-0 list-disc space-y-1 pl-4 text-xs leading-relaxed text-gray-400">
                  {hub.crossModuleDynamicsLines.slice(0, 12).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
              <h2 className="font-mono text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
                Spina lettura · copertura {hub.readSpineCoverage.spineScore}%
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["Profilo", hub.readSpineCoverage.hasProfile],
                    ["Fisiologia", hub.readSpineCoverage.hasPhysiology],
                    ["Twin", hub.readSpineCoverage.hasTwin],
                    ["Nutrizione", hub.readSpineCoverage.hasNutritionConstraints || hub.readSpineCoverage.hasNutritionDiary],
                  ] as const
                ).map(([label, on]) => (
                  <span
                    key={label}
                    className={`rounded-full px-2 py-0.5 font-mono text-[0.6rem] ${
                      on ? "bg-emerald-500/20 text-emerald-200" : "bg-white/5 text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Pro2ModulePageShell>
  );
}
