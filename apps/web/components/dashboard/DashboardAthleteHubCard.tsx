"use client";

import type { ReactNode } from "react";
import { useAthleteOperationalHub } from "@/lib/dashboard/use-athlete-operational-hub";
import { Pro2Link } from "@/components/ui/empathy";

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
        pagina Physiology hub bioenergetico.
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
            <details
              open
              className="mb-4 rounded-xl border border-orange-400/25 bg-orange-950/20 px-4 py-3 text-sm text-gray-200"
            >
              <summary className="cursor-pointer font-mono text-[0.65rem] uppercase tracking-wider text-orange-300/90">
                Segnali operativi · twin → loop adattamento → dial nutrizione
              </summary>
              <div className="mt-3 space-y-2 text-xs leading-relaxed">
                <p>
                  <span className="text-gray-500">Adattamento (twin):</span> atteso{" "}
                  {hub.operationalSignals.adaptationGuidance.expectedAdaptation.toFixed(2)} · osservato{" "}
                  {hub.operationalSignals.adaptationGuidance.observedAdaptation.toFixed(2)} · semaforo{" "}
                  <span className="font-mono text-amber-200">{hub.operationalSignals.adaptationGuidance.trafficLight}</span> ·
                  score {hub.operationalSignals.adaptationGuidance.scorePct}%
                </p>
                <p>
                  <span className="text-gray-500">Loop piano:</span>{" "}
                  <span className="font-mono text-cyan-200/90">{hub.operationalSignals.adaptationLoop.status}</span> ·
                  prossima azione{" "}
                  <span className="font-mono text-cyan-200/90">{hub.operationalSignals.adaptationLoop.nextAction}</span>
                  <span className="text-gray-500">
                    {" "}
                    · divergenza {hub.operationalSignals.adaptationLoop.divergenceScore.toFixed(2)}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Dial nutrizione/fueling:</span> energia training ×
                  {hub.operationalSignals.nutritionPerformanceIntegration.trainingEnergyScale.toFixed(2)} · CHO fueling ×
                  {hub.operationalSignals.nutritionPerformanceIntegration.fuelingChoScale.toFixed(2)} · bias proteine +
                  {hub.operationalSignals.nutritionPerformanceIntegration.proteinBiasPctPoints.toFixed(1)} pt
                </p>
                {hub.operationalSignals.nutritionPerformanceIntegration.rationale.length > 0 ? (
                  <ul className="list-inside list-disc text-gray-400">
                    {hub.operationalSignals.nutritionPerformanceIntegration.rationale.slice(0, 4).map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </details>
          ) : null}
          {hub.crossModuleDynamicsLines.length > 0 ? (
            <div className="mb-4 rounded-xl border border-cyan-500/25 bg-cyan-950/15 px-4 py-3 text-sm text-gray-200">
              <p className="font-mono text-[0.65rem] uppercase tracking-wider text-cyan-300/90">
                Dinamica incrociata · training ↔ nutrizione
              </p>
              <ul className="mt-2 list-inside list-disc text-xs leading-relaxed text-gray-400">
                {hub.crossModuleDynamicsLines.slice(0, 8).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
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
          </HubRow>
        </div>
      ) : null}
    </section>
  );
}
