"use client";

import type { ReactNode } from "react";
import { useAthleteOperationalHub } from "@/lib/dashboard/use-athlete-operational-hub";
import { Pro2Link } from "@/components/ui/empathy";
import type { OperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";

function parseDynamicsBracketLine(line: string): { tag: string; body: string } | null {
  const m = line.match(/^\[([^\]]+)\]\s*(.*)$/s);
  if (!m) return null;
  return { tag: m[1].trim(), body: m[2].trim() };
}

function trafficLightTone(tl: string): "green" | "amber" | "rose" | "slate" {
  if (tl === "green") return "green";
  if (tl === "yellow") return "amber";
  if (tl === "red") return "rose";
  return "slate";
}

function trafficLightTextClass(tl: string): string {
  const tone = trafficLightTone(tl);
  if (tone === "green") return "text-emerald-300";
  if (tone === "amber") return "text-amber-200";
  if (tone === "rose") return "text-rose-300";
  return "text-gray-300";
}

function HubOpCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone: "orange" | "cyan" | "violet" | "green" | "amber" | "rose" | "slate";
}) {
  const border =
    tone === "orange"
      ? "border-orange-400/25"
      : tone === "cyan"
        ? "border-cyan-400/25"
        : tone === "violet"
          ? "border-violet-400/25"
          : tone === "green"
            ? "border-emerald-500/30"
            : tone === "amber"
              ? "border-amber-400/25"
              : tone === "rose"
                ? "border-rose-400/25"
                : "border-white/10";
  const glow =
    tone === "orange"
      ? "from-orange-500/10"
      : tone === "cyan"
        ? "from-cyan-500/10"
        : tone === "violet"
          ? "from-violet-500/10"
          : tone === "green"
            ? "from-emerald-500/10"
            : tone === "amber"
              ? "from-amber-500/10"
              : tone === "rose"
                ? "from-rose-500/10"
                : "from-white/5";
  return (
    <div
      className={`relative overflow-hidden rounded-lg border ${border} bg-gradient-to-br ${glow} to-black/40 px-3 py-2.5`}
    >
      <div className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-gray-500">{label}</div>
      <div className="mt-1 break-words font-mono text-base font-semibold leading-tight text-gray-100">{value}</div>
      {sub ? <div className="mt-1 text-[0.65rem] leading-snug text-gray-500">{sub}</div> : null}
    </div>
  );
}

function HubOperationalDocs({
  signals,
  dynamicsLines,
}: {
  signals: OperationalSignalsBundle;
  dynamicsLines: string[];
}) {
  const ag = signals.adaptationGuidance;
  const loop = signals.adaptationLoop;
  const nut = signals.nutritionPerformanceIntegration;
  const op = signals.operationalContext;
  const expected = ag.expectedAdaptation;
  const observed = ag.observedAdaptation;
  const scoreFormula =
    expected > 0
      ? `scorePct = clamp((osservato / atteso) × 100, 0, 100) → (${observed} / ${expected}) × 100 ≈ ${ag.scorePct}%`
      : `atteso = 0: scorePct deriva dal solo osservato clampato (implementazione buildAdaptationGuidance).`;

  return (
    <details className="mt-3 mb-4 rounded-lg border border-white/10 bg-black/35 px-3 py-2 text-xs text-gray-400">
      <summary className="cursor-pointer font-mono text-[0.6rem] uppercase tracking-wider text-gray-300">
        Logica, formule e provenienza dati
      </summary>
      <div className="mt-3 space-y-4 border-t border-white/10 pt-3 leading-relaxed">
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-wider text-orange-300/90">Adattamento (twin)</p>
          <p className="mt-1">
            Valori <span className="text-gray-300">atteso / osservato</span> da{" "}
            <span className="text-gray-300">athlete_memory.twin</span> (expectedAdaptation, realAdaptation; fallback adaptationScore).
          </p>
          <p className="mt-1 font-mono text-[0.65rem] text-gray-500">{scoreFormula}</p>
          <p className="mt-1">
            Semaforo: verde se score ≥ 75%; giallo 50–75% (riduzione volume suggerita 30–50%); rosso &lt;50% (50–75%). Vedi{" "}
            <span className="text-gray-300">lib/adaptation/adaptation-guidance.ts</span>.
          </p>
          {ag.guidance ? <p className="mt-1 text-gray-500">{ag.guidance}</p> : null}
        </div>
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-wider text-cyan-300/90">Loop calendario (7 giorni)</p>
          <p className="mt-1">
            <span className="text-gray-300">divergenceScore</span>: da twin se presente, altrimenti{" "}
            <span className="font-mono text-gray-500">clamp(|ΔTSS 7g pianificato − eseguito| × 0.5, 0, 100)</span> con Δ da{" "}
            <span className="text-gray-300">planned_workouts</span> vs <span className="text-gray-300">executed_workouts</span>.
          </p>
          <p className="mt-1">
            Stato <span className="font-mono text-cyan-200/80">{loop.status}</span> e azione{" "}
            <span className="font-mono text-cyan-200/80">{loop.nextAction}</span> da regole in{" "}
            <span className="text-gray-300">adaptation-regeneration-loop.ts</span> (compliance, recovery, modalità protettiva, soglie
            divergenza).
          </p>
          {loop.guidance ? <p className="mt-1 text-gray-500">{loop.guidance}</p> : null}
        </div>
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-wider text-violet-300/90">Dial nutrizione ↔ training</p>
          <p className="mt-1">
            Motore deterministico <span className="text-gray-300">buildNutritionPerformanceIntegration</span>:{" "}
            <span className="font-mono text-gray-500">trainingEnergyScale = clamp(bioScale × opScale, 0.35, 1.02)</span> poi moltiplicatori
            diario (adeguacy), loop (×0.96 regenerate, ×0.985 watch), clamp finale; CHO intra e bias proteico da semaforo, bioenergetica,
            loop e diario. Vedi <span className="text-gray-300">lib/nutrition/performance-integration-scaler.ts</span>.
          </p>
          {nut.rationale.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-gray-500">
              {nut.rationale.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-wider text-cyan-300/90">Dinamica incrociata (righe)</p>
          <p className="mt-1">
            Stringhe da <span className="text-gray-300">buildOperationalDynamicsLines</span> (stesso payload API hub): adattamento,
            contesto operativo{op ? ` (~${op.loadScalePct}% · ${op.mode})` : ""}, loop, dial nutrizione.
          </p>
          {dynamicsLines.length > 0 ? (
            <ul className="mt-2 list-inside list-disc font-mono text-[0.65rem] text-gray-500">
              {dynamicsLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </details>
  );
}

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
  const { ctxLoading, loading, error: err, hub } = useAthleteOperationalHub();
  const showLoading = ctxLoading || loading;

  return (
    <section
      className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/30 p-6 text-left backdrop-blur-md"
      aria-label="Riepilogo atleta"
    >
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-orange-300">Dashboard · dati reali</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Hub operativo</h2>
        <Pro2Link
          href="/physiology/bioenergetics"
          variant="secondary"
          className="shrink-0 border border-emerald-500/35 bg-emerald-500/10 text-xs hover:bg-emerald-500/15"
        >
          Trasparenza · ledger
        </Pro2Link>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Sintesi da Supabase per l&apos;atleta attivo; training con finestra calendario (default −7 / +28 giorni). Stesso payload della
        pagina Physiology Bioenergetis.
      </p>

      {showLoading ? (
        <div className="mt-6 h-2 w-48 animate-pulse rounded-full bg-white/10" />
      ) : null}

      {!showLoading && err ? (
        <p className="mt-6 text-sm text-amber-300/90" role="alert">
          {err}
        </p>
      ) : null}

      {!showLoading && !err && hub ? (
        <div className="mt-6">
          {hub.operationalSignals ? (
            <div className="mb-4 rounded-xl border border-orange-400/25 bg-orange-950/20 px-4 py-3 text-sm text-gray-200">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-orange-300/90">
                Bioenergetis · twin → loop adattamento → dial nutrizione
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <HubOpCell
                  label="Twin · atteso"
                  value={hub.operationalSignals.adaptationGuidance.expectedAdaptation.toFixed(2)}
                  tone="orange"
                />
                <HubOpCell
                  label="Twin · osservato"
                  value={hub.operationalSignals.adaptationGuidance.observedAdaptation.toFixed(2)}
                  tone="orange"
                />
                <HubOpCell
                  label="Semaforo"
                  value={
                    <span className={trafficLightTextClass(hub.operationalSignals.adaptationGuidance.trafficLight)}>
                      {hub.operationalSignals.adaptationGuidance.trafficLight}
                    </span>
                  }
                  tone={trafficLightTone(hub.operationalSignals.adaptationGuidance.trafficLight)}
                />
                <HubOpCell label="Score %" value={`${hub.operationalSignals.adaptationGuidance.scorePct}%`} tone="slate" />
                <HubOpCell
                  label="Loop · stato"
                  value={<span className="text-cyan-200">{hub.operationalSignals.adaptationLoop.status}</span>}
                  tone="cyan"
                />
                <HubOpCell
                  label="Loop · prossima azione"
                  value={<span className="break-all text-cyan-200/90">{hub.operationalSignals.adaptationLoop.nextAction}</span>}
                  tone="cyan"
                />
                <HubOpCell
                  label="Loop · divergenza"
                  value={hub.operationalSignals.adaptationLoop.divergenceScore.toFixed(2)}
                  sub="Score 0–100 (twin o |ΔTSS|×0.5)"
                  tone="cyan"
                />
                <HubOpCell
                  label="Energia training"
                  value={`×${hub.operationalSignals.nutritionPerformanceIntegration.trainingEnergyScale.toFixed(2)}`}
                  tone="violet"
                />
                <HubOpCell
                  label="CHO fueling"
                  value={`×${hub.operationalSignals.nutritionPerformanceIntegration.fuelingChoScale.toFixed(2)}`}
                  tone="violet"
                />
                <HubOpCell
                  label="Bias proteine"
                  value={`+${hub.operationalSignals.nutritionPerformanceIntegration.proteinBiasPctPoints.toFixed(1)} pt`}
                  tone="violet"
                />
                <HubOpCell
                  label="Quota pasti / training"
                  value={`${Math.round(hub.operationalSignals.nutritionPerformanceIntegration.mealTrainingFraction * 100)}%`}
                  tone="violet"
                />
                <HubOpCell
                  label="Idratazione (floor)"
                  value={`×${hub.operationalSignals.nutritionPerformanceIntegration.hydrationFloorMultiplier.toFixed(2)}`}
                  tone="violet"
                />
                <HubOpCell
                  label="Trace coach in memoria"
                  value={hub.operationalSignals.coachValidatedApplicationTraceCount}
                  sub="Voci evidence `coach_manual_action` nel bundle"
                  tone="green"
                />
              </div>
            </div>
          ) : null}
          {hub.expectedVsObtainedPreview &&
          (hub.expectedVsObtainedPreview.loopClosureSummary ||
            hub.expectedVsObtainedPreview.date ||
            hub.expectedVsObtainedPreview.recentCoachTracesInHint > 0) ? (
            <div className="mb-4 rounded-xl border border-slate-500/25 bg-slate-950/25 px-4 py-3 text-xs text-gray-300">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-slate-400">Plan vs reality · ultimo delta</p>
              {hub.expectedVsObtainedPreview.date ? (
                <p className="mt-2 font-mono text-[0.7rem] text-gray-400">
                  {hub.expectedVsObtainedPreview.date}
                  {hub.expectedVsObtainedPreview.status ? ` · ${hub.expectedVsObtainedPreview.status}` : ""}
                </p>
              ) : null}
              {hub.expectedVsObtainedPreview.loopClosureSummary ? (
                <p className="mt-2 leading-relaxed text-gray-200">{hub.expectedVsObtainedPreview.loopClosureSummary}</p>
              ) : null}
              {hub.expectedVsObtainedPreview.recentCoachTracesInHint > 0 ? (
                <p className="mt-2 text-[0.65rem] text-slate-500">
                  Hint delta include {hub.expectedVsObtainedPreview.recentCoachTracesInHint} trace coach recenti.
                </p>
              ) : null}
            </div>
          ) : null}
          {hub.crossModuleDynamicsLines.length > 0 ? (
            <div className="mb-4 rounded-xl border border-cyan-500/25 bg-cyan-950/15 px-4 py-3 text-sm text-gray-200">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-cyan-300/90">
                Dinamica incrociata · training ↔ nutrizione
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {hub.crossModuleDynamicsLines.slice(0, 8).map((line, i) => {
                  const parsed = parseDynamicsBracketLine(line);
                  if (!parsed) {
                    return (
                      <HubOpCell key={i} label={`Riga ${i + 1}`} value={line} tone="slate" />
                    );
                  }
                  return <HubOpCell key={i} label={parsed.tag} value={parsed.body} tone="cyan" />;
                })}
              </div>
            </div>
          ) : null}
          {hub.operationalSignals ? (
            <HubOperationalDocs signals={hub.operationalSignals} dynamicsLines={hub.crossModuleDynamicsLines} />
          ) : null}
          <details className="mb-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
            <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-wider text-cyan-300/90">
              Spina lettura (athlete-memory) · copertura {hub.readSpineCoverage.spineScore}%
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["Profilo", hub.readSpineCoverage.hasProfile],
                  ["Fisiologia", hub.readSpineCoverage.hasPhysiology],
                  ["Twin", hub.readSpineCoverage.hasTwin],
                  ["Nutrizione", hub.readSpineCoverage.hasNutritionConstraints || hub.readSpineCoverage.hasNutritionDiary],
                  ["Health panels", hub.readSpineCoverage.hasHealthPanels],
                  ["Reality ingest", hub.readSpineCoverage.hasRealityIngestions],
                  ["Evidence items", hub.readSpineCoverage.hasEvidenceItems],
                  ["Memoria applicazioni coach", hub.readSpineCoverage.hasCoachApplicationMemory],
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
            {hub.readSpineCoverage.physiologySources ? (
              <p className="mt-2 text-xs text-gray-500">
                Fonti fisiologia: profilo {hub.readSpineCoverage.physiologySources.physiologicalProfile ? "✓" : "—"} · metabolic lab{" "}
                {hub.readSpineCoverage.physiologySources.metabolicRun ? "✓" : "—"} · lactate{" "}
                {hub.readSpineCoverage.physiologySources.lactateRun ? "✓" : "—"} · max ox{" "}
                {hub.readSpineCoverage.physiologySources.performanceRun ? "✓" : "—"} · biomarkers{" "}
                {hub.readSpineCoverage.physiologySources.biomarkerPanel ? "✓" : "—"}
              </p>
            ) : null}
          </details>
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
            <span className="mt-2 block text-xs text-gray-400">
              Analyzer 7g (TSS) {hub.training.analyzerAligned.last7.planned.toFixed(0)} /{" "}
              {hub.training.analyzerAligned.last7.executed.toFixed(0)} · compliance{" "}
              {hub.training.analyzerAligned.last7.compliancePct.toFixed(0)}%
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              28g {hub.training.analyzerAligned.last28.planned.toFixed(0)} /{" "}
              {hub.training.analyzerAligned.last28.executed.toFixed(0)} ·{" "}
              {hub.training.analyzerAligned.last28.compliancePct.toFixed(0)}% (
              {hub.training.analyzerAligned.fromDate} → {hub.training.analyzerAligned.toDate})
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
            {hub.health.lastSampleDate ? (
              <span className="mt-1 block text-xs text-gray-500">Ultimo sample: {hub.health.lastSampleDate}</span>
            ) : null}
            {hub.health.timelineDays != null ? (
              <span className="mt-1 block text-xs text-gray-500">Storico coperto: ~{hub.health.timelineDays} giorni</span>
            ) : null}
            {hub.health.byType.length > 0 ? (
              <span className="mt-1 block text-xs text-gray-500">
                Tipi:{" "}
                {hub.health.byType
                  .slice(0, 5)
                  .map((row) => `${row.type} (${row.count})`)
                  .join(" · ")}
              </span>
            ) : null}
          </HubRow>
        </div>
      ) : null}
    </section>
  );
}
