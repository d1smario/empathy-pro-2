import type { SupabaseClient } from "@supabase/supabase-js";
import { BIOENERGETIC_EVIDENCE_CURVE_CONTRACT_VERSION } from "@empathy/contracts";
import {
  SIM_BANK_VERSION,
  GLUCOSE_STIMULUS_PREDICTOR_CONTRACT_VERSION,
  GLUCOSE_STIMULUS_PREDICTOR_SOURCE_PREFIX,
  LACTATE_STIMULUS_PREDICTOR_CONTRACT_VERSION,
  LACTATE_STIMULUS_PREDICTOR_SOURCE_PREFIX,
  PRED_GLUCOSE_STIMULI_LITERATURE_MANIFEST_V1,
  PRED_LACTATE_STIMULI_LITERATURE_MANIFEST_V1,
  INSULIN_STIMULUS_PREDICTOR_CONTRACT_VERSION,
  INSULIN_STIMULUS_PREDICTOR_SOURCE_PREFIX,
  PRED_INSULIN_STIMULI_LITERATURE_MANIFEST_V1,
  buildMetabolicEndocrineInteractionReportV1,
  buildSimulatedGluLacDiurnalSubHourly,
  computeInternalContextRichness01,
  estimateLongestInterMealGapHours,
  kernelDayStress01,
  simBlendDeterministicWeightFromRichness01,
  synthesizeEvidenceConditionedLayerV1,
} from "@empathy/domain-bioenergetics";
import type {
  InsulinStimulusLiteratureManifestEntryV1,
} from "@empathy/domain-bioenergetics";
import type { BioenergeticsDayViewModel, BioenergeticsWindowViewModel, BioenergeticStimulusPredictorSubhourlyMetaV1 } from "@/api/bioenergetics/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { loadBioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { buildBioenergeticDaySeries, extractMeasuredGluLacFromSlice } from "@/lib/bioenergetics/day-curves-assembler";
import { buildBioenergeticDayPresentation } from "@/lib/bioenergetics/day-presentation";
import { computeBioenergeticDayKernel } from "@/lib/bioenergetics/day-response-kernel";
import { buildBioenergeticInterpretationHints } from "@/lib/bioenergetics/interpretation-bridge";
import { buildBioenergeticConditioningContextFromDay } from "@/lib/bioenergetics/build-bioenergetic-conditioning-context";
import { metabolicSleepContextFromConditioningContext } from "@/lib/bioenergetics/metabolic-sleep-context-from-conditioning";
import { somatoaxisLabFlagsFromBiomarkerRows } from "@/lib/bioenergetics/metabolic-somatoaxis-lab-flags";
import { sha256BioenergeticConditioningContext } from "@/lib/bioenergetics/canonical-conditioning-digest";
import { summarizeCanonicalTimeSeriesRows } from "@/lib/bioenergetics/canonical-time-series-summary";
import {
  loadBioenergeticEvidenceAxisFluidLinks,
  type LoadBioenergeticEvidenceLinksResult,
} from "@/lib/bioenergetics/load-bioenergetic-evidence-links";
import { enumerateInclusiveIsoDates } from "@/lib/bioenergetics/bioenergetic-window-range";
import { num } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";
import { buildBioenergeticDayTimeline } from "@/lib/bioenergetics/bioenergetic-day-timeline";
import { applyBioenergeticOpenAiGenerativeOverlay } from "@/lib/bioenergetics/bioenergetic-openai-generative-day";
import { buildBioenergeticMonitoringStripAuditV1 } from "@/lib/bioenergetics/monitoring-strip-audit-v1";
import {
  fusePlanRealityGluLacSim,
  planRealityFusionSummaryIt,
} from "@/lib/bioenergetics/plan-reality-curve-fusion";

function diaryMealsWithMacroCount(rows: BioenergeticDayMemorySlice["diaryRows"]): number {
  let n = 0;
  for (const row of rows) {
    const c = num(row.carbs_g);
    const k = num(row.kcal);
    if ((c ?? 0) > 3 || (k ?? 0) > 80) n += 1;
  }
  return n;
}

export type AssembleBioenergeticDayResult =
  | { ok: true; body: BioenergeticsDayViewModel }
  | { ok: false; status: number; error: string };

export type AssembleBioenergeticWindowResult =
  | { ok: true; body: BioenergeticsWindowViewModel }
  | { ok: false; status: number; error: string };

/**
 * Costruisce la VM giornata da slice già caricata e link evidenza già risolti (evita N query su finestra multi-giorno).
 */
export function buildBioenergeticDayViewModelFromSlice(input: {
  athleteId: string;
  date: string;
  slice: BioenergeticDayMemorySlice;
  evidenceLinks: LoadBioenergeticEvidenceLinksResult;
  /**
   * Se true, `buildBioenergeticDayPresentation` non costruisce la striscia deterministico-v1;
   * `assembleBioenergeticDay` la riempie con OpenAI dagli input (`ai_from_inputs_v1`).
   */
  omitMonitoringStrip?: boolean;
}): BioenergeticsDayViewModel {
  const { athleteId, date, slice, evidenceLinks, omitMonitoringStrip } = input;

  const { glucoseMeasured, lactateMeasured } = extractMeasuredGluLacFromSlice(slice);
  const timeline = buildBioenergeticDayTimeline(date, slice);

  const choIntakeG = slice.diaryRows.reduce((sum, row) => sum + (num(row.carbs_g) ?? 0), 0);
  const executedLoad = slice.executed.reduce((sum, row) => sum + Math.max(0, Number(row.tss ?? 0)), 0);
  const plannedLoad = slice.planned.reduce((sum, row) => sum + Math.max(0, Number(row.tssTarget ?? 0)), 0);
  const activityLoadScore = Math.max(0, Math.min(100, executedLoad > 0 ? executedLoad : plannedLoad));
  const avgInsulinLoad = slice.diaryRows.length
    ? slice.diaryRows.reduce((sum, row) => sum + (num(row.insulin_load) ?? 0), 0) / slice.diaryRows.length
    : 0;
  const kernel = computeBioenergeticDayKernel({
    choIntakeG,
    activityLoadScore,
    cgmPresent: glucoseMeasured.length > 0,
    lactatePresent: lactateMeasured.length > 0,
    gutConstraintScore: Math.max(0, Math.min(100, avgInsulinLoad)),
  });

  const arbTl = timeline.map((e) => ({ ts: e.ts, type: e.type, payload: e.payload }));
  const contextRichness01 = computeInternalContextRichness01(arbTl, slice.biomarkerRows.length);
  const deterministicBlend01 = simBlendDeterministicWeightFromRichness01(contextRichness01);
  const mealResponseScale01 = 0.36 + 0.64 * deterministicBlend01;
  const activityResponseScale01 = 0.4 + 0.6 * deterministicBlend01;

  const fusedSim =
    glucoseMeasured.length === 0 || lactateMeasured.length === 0
      ? fusePlanRealityGluLacSim({
          date,
          kernel,
          slice,
          nutritionPlan: slice.nutritionPlan,
          mealResponseScale01,
          activityResponseScale01,
          stepMinutes: 5,
        })
      : null;

  const simGluLac =
    fusedSim != null
      ? {
          glucose: fusedSim.glucose,
          lactate: fusedSim.lactate,
          insulinProxy: fusedSim.insulinProxy,
        }
      : glucoseMeasured.length === 0 || lactateMeasured.length === 0
        ? buildSimulatedGluLacDiurnalSubHourly(date, kernel, arbTl, {
            mealResponseScale01,
            activityResponseScale01,
          }, 5)
        : null;

  const planRealityFusionV1 = fusedSim?.meta;

  const stimulusPredictorSubhourlyV1: BioenergeticStimulusPredictorSubhourlyMetaV1 | undefined =
    simGluLac != null
      ? {
          contractVersion: 1,
          stepMinutes: 5,
          glucose: {
            predictorContractVersion: GLUCOSE_STIMULUS_PREDICTOR_CONTRACT_VERSION,
            sourcePrefix: GLUCOSE_STIMULUS_PREDICTOR_SOURCE_PREFIX,
            literatureManifestEntryIds: PRED_GLUCOSE_STIMULI_LITERATURE_MANIFEST_V1.map((e) => e.id),
          },
          lactate: {
            predictorContractVersion: LACTATE_STIMULUS_PREDICTOR_CONTRACT_VERSION,
            sourcePrefix: LACTATE_STIMULUS_PREDICTOR_SOURCE_PREFIX,
            literatureManifestEntryIds: PRED_LACTATE_STIMULI_LITERATURE_MANIFEST_V1.map((e) => e.id),
          },
          insulin: {
            predictorContractVersion: INSULIN_STIMULUS_PREDICTOR_CONTRACT_VERSION,
            sourcePrefix: INSULIN_STIMULUS_PREDICTOR_SOURCE_PREFIX,
            literatureManifestEntryIds: PRED_INSULIN_STIMULI_LITERATURE_MANIFEST_V1.map(
              (e: InsulinStimulusLiteratureManifestEntryV1) => e.id,
            ),
          },
        }
      : undefined;
  const glucoseEstimated = glucoseMeasured.length > 0 ? null : simGluLac?.glucose ?? null;
  const lactateEstimated = lactateMeasured.length > 0 ? null : simGluLac?.lactate ?? null;

  const channels = {
    glucose: glucoseMeasured.length ? glucoseMeasured : glucoseEstimated,
    lactate: lactateMeasured.length ? lactateMeasured : lactateEstimated,
    insulinProxyDense: simGluLac?.insulinProxy ?? null,
  };
  const provenance = {
    glucose: glucoseMeasured.length ? "measured" : glucoseEstimated ? "estimated" : "absent",
    lactate: lactateMeasured.length ? "measured" : lactateEstimated ? "estimated" : "absent",
  } as const;

  const series = buildBioenergeticDaySeries({ slice, provenance, channels });

  const conditioningContext = buildBioenergeticConditioningContextFromDay({
    athleteId,
    date,
    timeline,
    slice,
  });
  const sleepContextSnapshot = metabolicSleepContextFromConditioningContext(conditioningContext);

  const simKernel = {
    insulinDemandScore: kernel.insulinDemandScore,
    anabolicSuppressionScore: kernel.anabolicSuppressionScore,
    glucoseHandlingScore: kernel.glucoseHandlingScore,
    oxidationDriveScore: kernel.oxidationDriveScore,
    pathwayState: kernel.pathwayState,
  };
  const simTimeline = arbTl;
  const stress01Day = kernelDayStress01(simKernel);
  const interactionReport = buildMetabolicEndocrineInteractionReportV1({
    mealEntryCount: slice.diaryRows.length,
    mealWithMacroCount: diaryMealsWithMacroCount(slice.diaryRows),
    executedSessionCount: slice.executed.length,
    plannedSessionCount: slice.planned.length,
    stress01: stress01Day,
    longestInterMealGapHours: estimateLongestInterMealGapHours(arbTl),
    sleepContext: sleepContextSnapshot,
    choIntakeGramsDay: choIntakeG,
    insulinDemandScore01: kernel.insulinDemandScore,
    somatoaxisLab: somatoaxisLabFlagsFromBiomarkerRows(slice.biomarkerRows),
  });

  const { metricTiles, chart24h, continuousMonitoring } = buildBioenergeticDayPresentation({
    date,
    kernel,
    provenance,
    channels,
    timeline,
    biomarkerRows: slice.biomarkerRows,
    interactionNodes: interactionReport.nodes,
    omitMonitoringStrip: omitMonitoringStrip === true,
  });
  const contextDigest = sha256BioenergeticConditioningContext(conditioningContext);

  const evidenceConditionedLayer =
    evidenceLinks.ok && evidenceLinks.links.length > 0
      ? (() => {
          const bankRef = { bankId: "empathy_bioenergetic_axis_fluid_v1", bankVersion: "051+052+synth_v1" };
          const synth = synthesizeEvidenceConditionedLayerV1({
            date,
            kernel: simKernel,
            timeline: simTimeline,
            conditioningContext,
            contextDigest,
            bankRef,
            resolvedEvidenceLinks: evidenceLinks.links,
          });
          return {
            contractVersion: BIOENERGETIC_EVIDENCE_CURVE_CONTRACT_VERSION,
            bankRef,
            series: synth.series,
            resolvedEvidenceLinks: evidenceLinks.links,
            contributionGraph: synth.contributionGraph,
            disclaimersIt: [
              "Link assi ormonali / neuroendocrini ↔ fluidi: grafo curato in database (non generato da LLM). Non è diagnosi clinica.",
              "Serie «evidence_conditioned» v1: proxy deterministico 0–100 da kernel + timeline + peso link DB; non sostituisce misure cliniche né le curve glucosio/lattato operative.",
              "Grafo contributi: nodi kernel / training / nutrizione / DB → output sintetico per audit e UI «perché».",
            ],
          };
        })()
      : null;

  const interactionSkeleton = {
    contractVersion: 1 as const,
    northStarIt: interactionReport.northStarIt,
    edges: interactionReport.edges,
    longestInterMealGapHoursEstimate: interactionReport.longestInterMealGapHoursEstimate,
    nodes: interactionReport.nodes,
  };

  const canonicalStreamCounts = summarizeCanonicalTimeSeriesRows(slice.timeSeriesSamplesRows);

  const body: BioenergeticsDayViewModel = {
    dayContractVersion: 1,
    canonicalStreamCounts,
    athleteId,
    date,
    range: { from: `${date}T00:00:00`, to: `${date}T23:59:59` },
    timeline,
    channels,
    provenance,
    kernel,
    simBankVersion: SIM_BANK_VERSION,
    ...(stimulusPredictorSubhourlyV1 != null ? { stimulusPredictorSubhourlyV1 } : {}),
    ...(planRealityFusionV1 != null ? { planRealityFusionV1 } : {}),
    interpretationHints: buildBioenergeticInterpretationHints(kernel, {
      diaryEntryCount: slice.diaryRows.length,
      choIntakeG,
      executedTssSum: executedLoad,
      plannedTssSum: plannedLoad,
      glucoseProvenance: provenance.glucose,
      lactateProvenance: provenance.lactate,
      biomarkerPanelCount: slice.biomarkerRows.length,
      simBankVersion: SIM_BANK_VERSION,
    }),
    disclaimers: [
      "Le curve stimate sono modellazione deterministica operativa, non diagnosi clinica.",
      "Senza CGM/lab, glucosio e lattato seguono una diurna simulata (banca coefficienti v1), non misure continue.",
      "Quando presenti, i dati misurati (CGM/lab/device) hanno priorita sulle stime e sulle tile da referto.",
      "Campioni densi in `athlete_time_series_samples` (stesso `athlete_id` e giorno) si uniscono alle curve misurate con priorita sui punti export CGM a timestamp uguale; ingest resta su boundary adapter, non su route duplicate.",
      "Le tile lab senza valore nel panel usano ordini di grandezza simulati dal kernel (stesso modello v1), non risultati analitici.",
      "Tile ghrelina / GH: se la rete endocrina dichiara osservabilità «blocked» sul nodo skeleton e non c’è valore in panel, non viene mostrato un ordine di grandezza simulato (tile assente).",
      "Osservabilità «partial» (skeleton v1): ordini di grandezza sim tile lab senza referto sono attenuati con coefficiente `SIM_LAB_TILE_PARTIAL_SCALE_V1` nel dominio, non sostituiscono il lab.",
      "Nodo «sonno» nel grafo skeleton: deriva dagli stessi export wellness della contestualizzazione giorno (`sleepAutonomic`), non da una seconda query.",
      "Diurna cortisolo–ACTH nominale: pasti con CHO/kcal elevati in timeline modulano leggermente il profilo (coeff. `SIM_CORTISOL_MEAL_MOD_V1`), senza secondo motore parallelo.",
      "La striscia «monitoraggio continuo» mostra solo serie difendibili: glucosio/lattato (diario/sim o stream), domanda insulinica da pasti/sedute, cortisolo/ACTH (modello circadiano o lab tenuto). Nessuna curva decorativa per altri biomarker.",
      "Colori supportivo/neutro/inibitorio: modello operativo sulla giornata, non classificazione di laboratorio.",
      "Le serie aggiuntive (FC, CHO cumulativi, potenza da trace) dipendono da trace/diario disponibili per la data.",
      "La curva «Potenza (target da piano kJ/kcal)» è un vincolo energetico deterministico da `planned_workouts`, non una prescrizione FTP.",
      "Striscia monitoraggio continuo: policy fusione v1 — fase iniziale con peso maggiore al canale AI supervisionato sui sim; con contesto Empathy più ricco i pesi tendono al pareggio col motore. Merge numerico AI solo con endpoint e schema validati.",
      "Sim sub-oraria 5 min: tre predittori deterministici da stimoli (`glucose_stimulus_predictor_v1_5m`, `lactate_stimulus_predictor_v1_5m`, `insulin_stimulus_predictor_v1_5m`) convogliati in `buildSimulatedGluLacDiurnalSubHourly` (glucosio/lattato + superficie CGM-like; insulin proxy 0–100 senza superficie CGM); metadati in `stimulusPredictorSubhourlyV1`. L’orario insulinico in striscia è la media oraria del predittore 5 min quando la serie densa è disponibile.",
      planRealityFusionV1 != null ? planRealityFusionSummaryIt(planRealityFusionV1) : "",
      "Striscia operativa: predizione mattino da meal plan + training pianificato; adattamento pomeriggio-sera da diario e sedute eseguite quando presenti. Non sostituisce CGM né referto.",
    ].filter(Boolean),
    metricTiles,
    chart24h,
    continuousMonitoring,
    series,
    evidenceConditionedLayer,
    biaLiteratureSummary: conditioningContext.biaLiteratureSummary ?? null,
    interactionSkeleton,
  };

  return body;
}

/**
 * Assembler unico per GET bioenergetics/day: memoria giorno → canali → kernel → serie → presentation.
 *
 * Default prodotto: striscia `model_continuous_v1` con fusione piano→realtà (meal plan + training pianificato,
 * poi adattamento da diario + eseguito). OpenAI aggiorna solo le tile metriche, non la striscia.
 * Opzione `stripAudit: true` (query `stripAudit=1` sulla GET): aggiunge `monitoringStripAuditV1` nel body con input aggregati per verifica curve.
 * `POST merge-hourly-curve` richiede ancora la striscia deterministico-v1 con `curveResolution`: passare
 * `{ includeDeterministicMonitoringStripForMergeEndpoint: true }`.
 */
export async function assembleBioenergeticDay(
  db: SupabaseClient,
  athleteId: string,
  dateRaw: string,
  options?: { includeDeterministicMonitoringStripForMergeEndpoint?: boolean; stripAudit?: boolean },
): Promise<AssembleBioenergeticDayResult> {
  const date = dateRaw.trim().slice(0, 10);
  const { slice, queryError } = await loadBioenergeticDayMemorySlice(db, athleteId, date);
  if (queryError) {
    return { ok: false, status: 500, error: queryError };
  }
  const forMerge = options?.includeDeterministicMonitoringStripForMergeEndpoint === true;
  const evidenceLinks = forMerge
    ? await loadBioenergeticEvidenceAxisFluidLinks(db)
    : ({ ok: false as const, links: [], error: "skipped_generative_product_path" } satisfies LoadBioenergeticEvidenceLinksResult);

  if (forMerge) {
    const body = buildBioenergeticDayViewModelFromSlice({
      athleteId,
      date,
      slice,
      evidenceLinks,
      omitMonitoringStrip: false,
    });
    if (options?.stripAudit === true) {
      return {
        ok: true,
        body: {
          ...body,
          monitoringStripAuditV1: buildBioenergeticMonitoringStripAuditV1(body, slice),
        },
      };
    }
    return { ok: true, body };
  }

  const deterministicVm = buildBioenergeticDayViewModelFromSlice({
    athleteId,
    date,
    slice,
    evidenceLinks,
    omitMonitoringStrip: false,
  });

  const overlaid = await applyBioenergeticOpenAiGenerativeOverlay(
    buildBioenergeticDayViewModelFromSlice({
      athleteId,
      date,
      slice,
      evidenceLinks,
      omitMonitoringStrip: true,
    }),
    slice,
  );

  let body: BioenergeticsDayViewModel = {
    ...overlaid,
    continuousMonitoring: deterministicVm.continuousMonitoring,
    chart24h: deterministicVm.chart24h,
    planRealityFusionV1: deterministicVm.planRealityFusionV1,
    series: deterministicVm.series,
    evidenceConditionedLayer: deterministicVm.evidenceConditionedLayer,
    interactionSkeleton: deterministicVm.interactionSkeleton,
    biaLiteratureSummary: deterministicVm.biaLiteratureSummary,
    interpretationHints: deterministicVm.interpretationHints,
    disclaimers: [...deterministicVm.disclaimers, ...overlaid.disclaimers.filter((d) => !d.includes("OpenAI"))],
  };

  if (options?.stripAudit === true) {
    return {
      ok: true,
      body: {
        ...body,
        monitoringStripAuditV1: buildBioenergeticMonitoringStripAuditV1(body, slice),
      },
    };
  }

  return { ok: true, body };
}

/**
 * Finestra multi-giorno: una sola query evidenza assi↔fluidi; slice per giorno in parallelo; stessa VM per giorno del singolo GET.
 */
export async function assembleBioenergeticWindow(
  db: SupabaseClient,
  athleteId: string,
  fromRaw: string,
  toRaw: string,
): Promise<AssembleBioenergeticWindowResult> {
  const range = enumerateInclusiveIsoDates(fromRaw, toRaw);
  if (!range.ok) {
    return { ok: false, status: 400, error: range.error };
  }
  const dates = range.dates;
  const evidenceLinks = await loadBioenergeticEvidenceAxisFluidLinks(db);
  const sliceResults = await Promise.all(dates.map((d) => loadBioenergeticDayMemorySlice(db, athleteId, d)));
  const failed = sliceResults.find((r) => r.queryError);
  if (failed?.queryError) {
    return { ok: false, status: 500, error: failed.queryError };
  }
  const days = dates.map((d, i) =>
    buildBioenergeticDayViewModelFromSlice({
      athleteId,
      date: d,
      slice: sliceResults[i]!.slice,
      evidenceLinks,
    }),
  );
  const body: BioenergeticsWindowViewModel = {
    windowContractVersion: 1,
    dayContractVersion: 1,
    athleteId,
    from: dates[0]!,
    to: dates[dates.length - 1]!,
    days,
  };
  return { ok: true, body };
}
