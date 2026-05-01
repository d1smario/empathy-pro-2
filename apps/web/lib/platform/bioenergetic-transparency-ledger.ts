import type { OperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";

/**
 * Riga audit: da quale segnale Compute deriva un effetto su quale consumatore (VIRYA, nutrizione, builder come contesto).
 * Solo testo deterministico — nessun LLM.
 */
export type BioenergeticInfluenceLedgerRow = {
  id: string;
  source: string;
  consumer: string;
  effect: string;
};

/**
 * Deriva righe tabellari dal bundle operativo già risolto (stessa fonte di dashboard / nutrition module).
 */
export function buildInfluenceLedgerRowsFromOperationalBundle(
  bundle: OperationalSignalsBundle | null | undefined,
): BioenergeticInfluenceLedgerRow[] {
  if (!bundle) return [];

  const g = bundle.adaptationGuidance;
  const loop = bundle.adaptationLoop;
  const nut = bundle.nutritionPerformanceIntegration;
  const bio = bundle.bioenergeticModulation;
  const ctx = bundle.operationalContext;

  const rows: BioenergeticInfluenceLedgerRow[] = [
    {
      id: "twin_adaptation",
      source: "Twin · adattamento atteso vs osservato",
      consumer: "Loop calendario / VIRYA (input)",
      effect: `semaforo ${g.trafficLight} · score ${g.scorePct}% · atteso ${g.expectedAdaptation.toFixed(2)} vs osservato ${g.observedAdaptation.toFixed(2)}`,
    },
    {
      id: "regen_loop",
      source: "Carico pianificato vs eseguito + recovery",
      consumer: "VIRYA · ritune microciclo",
      effect: `status ${loop.status} · next ${loop.nextAction} · divergenza ${loop.divergenceScore.toFixed(1)}`,
    },
  ];

  if (ctx) {
    rows.push({
      id: "day_context",
      source: "Recovery + semaforo adattamento",
      consumer: "Contesto operativo giornata",
      effect: `modalità ${ctx.mode} · scala carico giorno ${(ctx.loadScalePct ?? Math.round(ctx.loadScale * 100))}% · ${ctx.headline}`,
    });
  }

  if (bio) {
    rows.push({
      id: "bio_mod",
      source: "Fisiologia + twin + recovery",
      consumer: "Modulazione bioenergetica (scala carico)",
      effect: `load ×${bio.loadScale.toFixed(2)} (${bio.loadScalePct.toFixed(0)}%) · stato ${bio.state} · ${bio.headline}`,
    });
  }

  rows.push({
    id: "nutrition_dials",
    source: "Twin + diario + contesto training",
    consumer: "Nutrizione · solver / fueling (dial)",
    effect: `E_train ×${nut.trainingEnergyScale.toFixed(2)} · CHO ×${nut.fuelingChoScale.toFixed(2)} · proteine +${nut.proteinBiasPctPoints.toFixed(1)} pt · idratazione ×${nut.hydrationFloorMultiplier.toFixed(2)}`,
  });

  if (bundle.coachValidatedApplicationTraceCount > 0) {
    rows.push({
      id: "coach_memory_trace",
      source: "athlete_coach_application_traces → evidenceMemory",
      consumer: "VIRYA / nutrition directive / expected-vs-obtained hint",
      effect: `${bundle.coachValidatedApplicationTraceCount} voci memoria coach validate nel bundle operativo.`,
    });
  }

  rows.push({
    id: "builder_context",
    source: "Stesso bundle + contract sessione",
    consumer: "Builder sessione (contesto)",
    effect:
      "Il builder materializza la singola sessione; carico e intent devono arrivare da piano VIRYA/calendario aggiornato, non da copy UI.",
  });

  return rows;
}
