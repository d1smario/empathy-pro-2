import type {
  EmpathyAdvisoryNote,
  EmpathyApplicationPlaybook,
  EmpathyFuelingAdvice,
  EmpathyGapAnalysisItem,
  EmpathyInterrogationMap,
  EmpathyNutritionAdviceItem,
  EmpathyOperationalDirective,
  EmpathyTimingProtocol,
} from "@empathy/contracts";
import { resolveStimulusProfileFromAdaptationTarget } from "@empathy/domain-knowledge";
import type { NutritionPathwayModulationViewModel } from "@/api/nutrition/contracts";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";
import type { NutritionDailyEnergyModel } from "@/lib/empathy/schemas";
import type { HealthLabPathwayBridgeResult } from "@/lib/nutrition/health-lab-pathway-bridge";
import type { RecoverySummary } from "@/lib/reality/recovery-summary";

const DISCLAIMER =
  "Interpretazione sportiva deterministica EMPATHY: non sostituisce parere medico. Numeri kcal/CHO/h dal solver.";

export type BuildEmpathyApplicationPlaybookInput = {
  athleteId: string;
  anchorDate: string;
  interrogationMap: EmpathyInterrogationMap;
  plannedSessions: Array<{ label: string; adaptationTarget: string | null }>;
  pathwayModulation: NutritionPathwayModulationViewModel | null;
  healthLabBridge: HealthLabPathwayBridgeResult | null;
  recoverySummary: RecoverySummary | null;
  nutritionPerformanceIntegration: NutritionPerformanceIntegrationDials | null;
  dailyEnergyModel: NutritionDailyEnergyModel | null;
};

function uniqId(prefix: string, n: number) {
  return `${prefix}_${n}`;
}

export function buildEmpathyApplicationPlaybook(
  input: BuildEmpathyApplicationPlaybookInput,
): EmpathyApplicationPlaybook {
  const primary = input.plannedSessions[0];
  const stimulus = resolveStimulusProfileFromAdaptationTarget(primary?.adaptationTarget);
  const pathways = input.pathwayModulation?.pathways ?? [];
  const nutritionAdvice: EmpathyNutritionAdviceItem[] = [];
  const timingProtocols: EmpathyTimingProtocol[] = [];
  const advisoryNotes: EmpathyAdvisoryNote[] = [];
  const directives: EmpathyOperationalDirective[] = [];
  const gapAnalysis: EmpathyGapAnalysisItem[] = [];
  const supplementHints: string[] = [];
  let n = 0;

  for (const p of pathways) {
    for (const ph of p.phases) {
      timingProtocols.push({
        id: uniqId("tp", n++),
        phase: ph.phase,
        windowLabelIt: ph.windowLabel,
        actionsIt: ph.actions.filter(Boolean).slice(0, 3),
        pathwayLabel: p.pathwayLabel,
        confidence: p.confidence === "session_knowledge" ? "session_knowledge" : "engine_derived",
        evidenceRefs: [`pathway:${p.id}`, `phase:${ph.phase}`],
      });
    }
  }

  const earlyRecovery = timingProtocols.find((t) => t.phase === "early_recovery");
  if (earlyRecovery) {
    nutritionAdvice.push({
      id: uniqId("nut", n++),
      headlineIt: "Recovery precoce post-seduta",
      actionIt: earlyRecovery.actionsIt.join(" ") || "CHO + leucina nella finestra 0–2 h.",
      timingWindowIt: earlyRecovery.windowLabelIt,
      rationaleIt: `Allineato a ${earlyRecovery.pathwayLabel ?? "risintesi glicogeno"}.`,
      confidence: "engine_derived",
      evidenceRefs: earlyRecovery.evidenceRefs,
      linkedComputeRefs: ["pathway:glycogen_resynthesis"],
    });
  }

  if (stimulus.id === "z5_vo2max" || stimulus.pathwayTags.includes("HIF")) {
    nutritionAdvice.push({
      id: uniqId("nut", n++),
      headlineIt: "Supporto asse ipossico",
      actionIt:
        "Priorizzare ferro, B12 e folati nei pasti solidi nelle 4–8 h post-sforzo ipossico (se lab ok o già in dieta).",
      timingWindowIt: "4–8 h post-seduta intensa",
      rationaleIt: "VO2 / HIF-VEGF richiedono cofattori eritropoietici — timing da pathway, non dose clinica.",
      confidence: "engine_derived",
      evidenceRefs: ["stimulus:z5_vo2max", "pathway:hypoxia"],
      linkedComputeRefs: ["pathway:multiscale_hypoxia"],
    });
    directives.push({
      id: uniqId("dir", n++),
      sector: "molecular_pathways",
      headlineIt: "Asse ipossico · cofattori",
      actionIt: "Verificare ferritina/B12 in Health; pasti post-gara con supporto CHO + micronutrienti.",
      timingWindowIt: "Post-seduta",
      severity: "watch",
      confidence: "engine_derived",
      evidenceRefs: ["stimulus:z5_vo2max"],
      leverTargets: ["nutrition", "dashboard_kpi"],
    });
  }

  if (stimulus.id === "z4_threshold" || stimulus.pathwayTags.includes("lactate_buffering")) {
    advisoryNotes.push({
      id: uniqId("adv", n++),
      sector: "energy_systems",
      textIt: "Soglia/lattato: favorire buffering peri (CHO fluidi) e sodio se seduta lunga — vedi Fueling.",
      confidence: "engine_derived",
      evidenceRefs: ["stimulus:z4_threshold"],
    });
  }

  const redoxPathway = pathways.find((p) => p.id === "mitochondrial_redox_support");
  if (redoxPathway) {
    nutritionAdvice.push({
      id: uniqId("nut", n++),
      headlineIt: "Supporto redox mitocondriale",
      actionIt: "Polifenoli, selenio/zinco e vit C da alimenti; evitare pasto iperlipidico pre-intenso.",
      timingWindowIt: "Giornata + peri-workout",
      rationaleIt: redoxPathway.pathwayLabel,
      confidence: "engine_derived",
      evidenceRefs: ["pathway:mitochondrial_redox_support"],
      linkedComputeRefs: ["twin:redox", "physiology:redox"],
    });
  }

  for (const sig of input.healthLabBridge?.markerSignals ?? []) {
    gapAnalysis.push({
      nutrientOrCofactor: sig.marker,
      status: sig.status === "low" ? "low_signal" : "adequate",
      detailIt: `${sig.marker} ${sig.status} (${sig.value})`,
      evidenceRefs: [`lab:${sig.marker}`],
    });
    if (sig.status === "low" && (sig.marker === "ferritina" || sig.marker === "b12")) {
      nutritionAdvice.push({
        id: uniqId("nut", n++),
        headlineIt: `Supporto ${sig.marker}`,
        actionIt: `Enfatizzare alimenti/ricchezza o integrazione già in profilo per ${sig.marker} basso.`,
        timingWindowIt: "Pasti principali lontano da finestra intensa",
        rationaleIt: "Gap lab vs cofattori pathway attivi.",
        confidence: "health_lab",
        evidenceRefs: [`lab:${sig.marker}`],
        linkedComputeRefs: ["health_lab:markers"],
      });
      supplementHints.push(`Verificare ${sig.marker} con medico; dieta può supportare se già in piano integrazione.`);
    }
  }

  const fueling = buildFuelingAdvice(input, primary?.label ?? "Seduta");
  const integration = input.nutritionPerformanceIntegration;
  if (integration?.rationale.length) {
    advisoryNotes.push({
      id: uniqId("adv", n++),
      sector: "fueling_levers",
      textIt: integration.rationale.slice(0, 2).join(" · "),
      confidence: "engine_derived",
      evidenceRefs: ["nutrition_performance_integration"],
    });
  }

  if (input.recoverySummary?.guidance?.trim()) {
    advisoryNotes.push({
      id: uniqId("adv", n++),
      sector: "recovery_levers",
      textIt: input.recoverySummary.guidance.trim().slice(0, 200),
      confidence: "engine_derived",
      evidenceRefs: [`recovery:${input.recoverySummary.status ?? "unknown"}`],
    });
  }

  if (!input.plannedSessions.length) {
    directives.push({
      id: uniqId("dir", n++),
      sector: "training",
      headlineIt: "Giorno senza seduta pianificata",
      actionIt: "Priorità recovery e pasti da profilo Diet; fueling ridotto salvo doppia seduta.",
      timingWindowIt: "Giornata",
      severity: "info",
      confidence: "engine_derived",
      evidenceRefs: ["training:none"],
      leverTargets: ["nutrition", "recovery"],
    });
  } else {
    directives.push({
      id: uniqId("dir", n++),
      sector: "training",
      headlineIt: stimulus.labelIt,
      actionIt: `Seduta: ${primary?.label ?? "—"} · seguire playbook timing e fueling.`,
      timingWindowIt: "Oggi",
      severity: "info",
      confidence: "engine_derived",
      evidenceRefs: [`stimulus:${stimulus.id}`],
      leverTargets: ["training", "nutrition", "fueling"],
    });
  }

  const playbookHeadline = `${input.interrogationMap.headlineIt} → ${nutritionAdvice.length} consigli nutrizione, ${timingProtocols.length} protocolli timing`;

  return {
    schemaVersion: 1,
    policyVersion: "empathy.interrogation.policy_v1",
    athleteId: input.athleteId,
    anchorDate: input.anchorDate,
    playbookHeadlineIt: playbookHeadline,
    nutritionAdvice: nutritionAdvice.slice(0, 12),
    fuelingAdvice: fueling,
    timingProtocols: timingProtocols.slice(0, 16),
    advisoryNotes: advisoryNotes.slice(0, 10),
    supplementHints: supplementHints.slice(0, 6),
    directives: directives.slice(0, 8),
    gapAnalysis: gapAnalysis.slice(0, 12),
    disclaimerIt: DISCLAIMER,
  };
}

function buildFuelingAdvice(
  input: BuildEmpathyApplicationPlaybookInput,
  sessionLabel: string,
): EmpathyFuelingAdvice | null {
  if (!input.plannedSessions.length) return null;
  const dem = input.dailyEnergyModel;
  const cho = dem?.fueling?.adjustedChoGPerHour;
  const tier = dem?.fueling?.capabilityTier;
  const hints: EmpathyFuelingAdvice["integrationFavoring"] = [];
  const notes: string[] = [];

  if (cho != null && cho > 0) {
    notes.push(`CHO intra target dal solver: ~${Math.round(cho)} g/h (non modificato dal playbook).`);
  }
  if (tier) {
    notes.push(`Tier capability: ${tier}.`);
  }

  const scale = input.nutritionPerformanceIntegration?.fuelingChoScale;
  if (scale != null && scale !== 1) {
    notes.push(`Leva integrazione CHO scale: ×${scale.toFixed(2)} (operational bundle).`);
  }

  hints.push({
    productClass: "gel_cho_electrolyte",
    reasonIt: "Integrazione favorevole peri/intra quando seduta >75 min o CHO/h elevati.",
    timingIt: "Peri-workout e ogni 20–45 min in seduta",
  });
  hints.push({
    productClass: "sport_drink",
    reasonIt: "Idratazione + CHO con osmolalità controllata se storico GI sensibile.",
    timingIt: "Durata seduta",
  });

  return {
    sessionLabel,
    choPerHourRef: cho != null ? `dailyEnergyModel.fueling.adjustedChoGPerHour=${Math.round(cho)}` : undefined,
    tierBandRef: tier ? `dailyEnergyModel.fueling.capabilityTier=${tier}` : undefined,
    hydrationRef: input.nutritionPerformanceIntegration
      ? `hydrationFloorMultiplier=${input.nutritionPerformanceIntegration.hydrationFloorMultiplier}`
      : undefined,
    integrationFavoring: hints,
    protocolNotes: notes,
    evidenceRefs: ["daily_energy_model", "fueling_protocol"],
  };
}
