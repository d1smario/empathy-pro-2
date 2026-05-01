"use client";

import { useMemo } from "react";
import { buildInfluenceLedgerRowsFromOperationalBundle } from "@/lib/platform/bioenergetic-transparency-ledger";
import { useAthleteOperationalHub } from "@/lib/dashboard/use-athlete-operational-hub";
import { Pro2ModulePageShell } from "@/components/shell/Pro2ModulePageShell";
import { Pro2Link } from "@/components/ui/empathy";
import { moduleEyebrowClass } from "@/core/navigation/module-ui-accent";

export default function BioenergeticTransparencyHubPageView() {
  const { ctxLoading, loading, error: err, hub } = useAthleteOperationalHub();
  const showLoading = ctxLoading || loading;
  const ledger = useMemo(
    () => buildInfluenceLedgerRowsFromOperationalBundle(hub?.operationalSignals ?? null),
    [hub?.operationalSignals],
  );

  const sig = hub?.operationalSignals;

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
            <section className="rounded-2xl border border-white/10 bg-black/30 p-6">
              <h2 className="font-mono text-[0.65rem] font-bold uppercase tracking-wider text-emerald-300/90">Pipeline canonica</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gray-300">
                <li>Realtà del giorno e memoria atleta alimentano il bundle operativo (Compute).</li>
                <li>
                  <strong className="text-white">VIRYA</strong> consuma stato loop, divergenza e contesto per ritunare carico / microciclo (Application
                  sul piano).
                </li>
                <li>
                  <strong className="text-white">Builder</strong> materializza la singola sessione; non sostituisce VIRYA sul programma macro.
                </li>
                <li>I dial nutrizione/fueling scalano solver e fueling a partire dagli stessi segnali.</li>
              </ol>
            </section>

            {ledger.length > 0 ? (
              <section className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-6">
                <h2 className="font-mono text-[0.65rem] font-bold uppercase tracking-wider text-cyan-300/90">Influence ledger (audit)</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Righe derivate deterministicamente dal bundle — nessuna scrittura DB da questa pagina.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[0.65rem] uppercase tracking-wider text-gray-500">
                        <th className="py-2 pr-3 font-medium">Fonte</th>
                        <th className="py-2 pr-3 font-medium">Consumatore</th>
                        <th className="py-2 font-medium">Effetto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.map((row) => (
                        <tr key={row.id} className="border-b border-white/5 align-top text-gray-300">
                          <td className="py-2.5 pr-3 text-emerald-100/90">{row.source}</td>
                          <td className="py-2.5 pr-3 text-slate-300">{row.consumer}</td>
                          <td className="py-2.5 text-gray-400">{row.effect}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {sig ? (
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-orange-400/25 bg-orange-950/15 p-5 text-sm text-gray-200">
                  <h3 className="font-mono text-[0.65rem] uppercase tracking-wider text-orange-300/90">Twin e loop</h3>
                  <p className="mt-2 text-xs leading-relaxed">
                    Adattamento atteso {sig.adaptationGuidance.expectedAdaptation.toFixed(2)} · osservato{" "}
                    {sig.adaptationGuidance.observedAdaptation.toFixed(2)} · semaforo{" "}
                    <span className="font-mono text-amber-200">{sig.adaptationGuidance.trafficLight}</span>
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-400">
                    Loop: <span className="font-mono text-cyan-200/90">{sig.adaptationLoop.status}</span> · next{" "}
                    <span className="font-mono text-cyan-200/90">{sig.adaptationLoop.nextAction}</span> · divergenza{" "}
                    {sig.adaptationLoop.divergenceScore.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-950/10 p-5 text-sm text-gray-200">
                  <h3 className="font-mono text-[0.65rem] uppercase tracking-wider text-fuchsia-300/90">Dial nutrizione / fueling</h3>
                  <p className="mt-2 text-xs leading-relaxed">
                    E_train ×{sig.nutritionPerformanceIntegration.trainingEnergyScale.toFixed(2)} · CHO ×
                    {sig.nutritionPerformanceIntegration.fuelingChoScale.toFixed(2)} · proteine +
                    {sig.nutritionPerformanceIntegration.proteinBiasPctPoints.toFixed(1)} pt · idratazione ×
                    {sig.nutritionPerformanceIntegration.hydrationFloorMultiplier.toFixed(2)}
                  </p>
                  {sig.nutritionPerformanceIntegration.rationale.length > 0 ? (
                    <ul className="mt-2 list-inside list-disc text-xs text-gray-500">
                      {sig.nutritionPerformanceIntegration.rationale.slice(0, 5).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {sig.bioenergeticModulation ? (
                  <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-5 text-sm text-gray-200 lg:col-span-2">
                    <h3 className="font-mono text-[0.65rem] uppercase tracking-wider text-emerald-300/90">Modulazione bioenergetica</h3>
                    <p className="mt-2 text-xs leading-relaxed text-gray-300">{sig.bioenergeticModulation.headline}</p>
                    <p className="mt-1 text-xs text-gray-500">{sig.bioenergeticModulation.guidance}</p>
                    <p className="mt-2 font-mono text-[0.65rem] text-gray-400">
                      load ×{sig.bioenergeticModulation.loadScale.toFixed(2)} · stato {sig.bioenergeticModulation.state} · copertura segnali{" "}
                      {sig.bioenergeticModulation.signalCoveragePct.toFixed(0)}%
                    </p>
                  </div>
                ) : null}
              </section>
            ) : (
              <p className="text-sm text-gray-500">
                Bioenergetis non disponibile (memoria atleta assente o errore nel bundle). Verifica dati twin/fisiologia e riprova.
              </p>
            )}

            {hub.crossModuleDynamicsLines.length > 0 ? (
              <section className="rounded-2xl border border-cyan-500/20 bg-black/25 p-6">
                <h2 className="font-mono text-[0.65rem] font-bold uppercase tracking-wider text-cyan-300/90">
                  Dinamica incrociata · training ↔ nutrizione
                </h2>
                <ul className="mt-3 list-inside list-disc space-y-1 text-xs leading-relaxed text-gray-400">
                  {hub.crossModuleDynamicsLines.slice(0, 12).map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </section>
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
