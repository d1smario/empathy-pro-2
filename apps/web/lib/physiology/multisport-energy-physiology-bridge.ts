/**
 * Collega `computeMultisportEnergyEngine` al canone Physiology Pro 2:
 * payload `metabolic_lab_runs` (sezioni metabolic_profile + lactate_analysis) consumati da
 * `resolveCanonicalPhysiologyState` in `profile-resolver.ts`.
 *
 * Per la **curva CP a 8 punti** (stesso canone del lab) usa invece
 * `computeMultisportCpCurveSuggestion` + `POST /api/physiology/multisport-cp-curve` → output manuale
 * da incollare nella scheda Metabolic profile, poi salva snapshot come oggi.
 *
 * La potenza `mechanical_equivalent_cycling_w` alimenta FTP **solo come fallback** quando
 * mancano FTP espliciti negli snapshot — non sovrascrive curva CP da lab.
 */

import { computeLactateEngine } from "@/lib/engines/lactate-engine";
import {
  computeMultisportEnergyEngine,
  type MultisportEnergyEngineInput,
  type MultisportEnergyEngineOutput,
} from "@/lib/engines/multisport-energy-engine";

const RER = 0.93;

/** Soglia W per scala %FTP nel motore lactato quando non c’è FTP ciclismo reale. */
function referenceThresholdWatts(input: MultisportEnergyEngineInput, out: MultisportEnergyEngineOutput): number {
  if (input.sport === "cycling" && input.ftpWatts && input.ftpWatts > 40) {
    return input.ftpWatts;
  }
  const ir = Math.max(0.38, out.intensityRatio);
  return Math.max(85, Math.round(out.pFinalW / ir));
}

export type MultisportPhysiologyBridgeResult = {
  engine: MultisportEnergyEngineOutput;
  /** `output_payload` per riga `metabolic_lab_runs` section=metabolic_profile (merge con CP se serve lato client). */
  metabolicProfileOutputPayload: Record<string, unknown>;
  /** `input_payload` per lactate_analysis (audit). */
  lactateInputPayload: Record<string, unknown>;
  /** `output_payload` per lactate_analysis. */
  lactateOutputPayload: Record<string, unknown>;
};

/**
 * Produce i tre blob JSON pronti per `POST /api/physiology/snapshot` (due chiamate: metabolic + lactate).
 */
export function buildPhysiologyPayloadsFromMultisport(input: MultisportEnergyEngineInput): MultisportPhysiologyBridgeResult {
  const engine = computeMultisportEnergyEngine(input);
  const thresholdW = referenceThresholdWatts(input, engine);
  const durationMin = Math.max(1, Math.round(input.durationSec / 60));
  const eta = input.efficiency ?? 0.24;

  const cpW = input.sport === "cycling" && input.ftpWatts && input.ftpWatts > 40 ? input.ftpWatts * 0.975 : undefined;
  const wPrimeJ = input.sport === "cycling" && input.ftpWatts && input.ftpWatts > 40 ? 16000 : undefined;

  const lactateOut = computeLactateEngine({
    durationMin,
    powerW: engine.pFinalW,
    ftpW: thresholdW,
    efficiency: eta,
    vo2LMin: Math.max(0.25, engine.vo2LMin),
    rer: RER,
    smo2Rest: 85,
    smo2Work: Math.max(56, Math.round(85 - engine.metabolicLoad01 * 26)),
    lactateOxidationPct: 52,
    coriPct: 28,
    choIngestedGH: 0,
    gutAbsorptionPct: 82,
    microbiotaSequestrationPct: 6,
    gutTrainingPct: 35,
    cpW,
    wPrimeJ,
  });

  const kcalH = (engine.pFinalW / Math.max(0.18, eta)) * 3.6;
  const choGPerMin = ((kcalH * engine.choOxFraction01) / 4) / 60;
  const fatGPerMin = ((kcalH * engine.fatOxFraction01) / 9) / 60;

  const metabolicProfileOutputPayload: Record<string, unknown> = {
    version: engine.modelVersion,
    empathy_multisport: true,
    empathy_multisport_sport: engine.sport,
    mechanical_equivalent_cycling_w: engine.pFinalW,
    multisport_p_met_w: engine.pMetW,
    multisport_p_final_w: engine.pFinalW,
    multisport_neuromuscular_factor: engine.neuromuscularFactor,
    multisport_intensity_ratio: engine.intensityRatio,
    multisport_zone: engine.zoneLabel,
    multisport_epi: engine.epi,
    multisport_edi: engine.edi,
    multisport_fatigue_score: engine.fatigueScore,
    vo2_session_ml_kg_min: engine.vo2MlKgMin,
    vo2_method: engine.vo2Method,
    cho_g_min: round2(choGPerMin),
    fat_g_min: round2(fatGPerMin),
    intensity_threshold_w: thresholdW,
  };

  const lactateInputPayload: Record<string, unknown> = {
    source: "empathy_multisport_energy_v0.1",
    sport: input.sport,
    duration_min: durationMin,
    power_w: engine.pFinalW,
    ftp_reference_w: thresholdW,
    ftp_cycling_w: input.ftpWatts ?? null,
    vo2_l_min: engine.vo2LMin,
    body_mass_kg: input.bodyMassKg,
  };

  const lactateOutputPayload: Record<string, unknown> = { ...lactateOut };

  return {
    engine,
    metabolicProfileOutputPayload,
    lactateInputPayload,
    lactateOutputPayload,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
