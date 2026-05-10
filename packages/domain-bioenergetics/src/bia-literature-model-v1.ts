/**
 * Modello deterministico BIA → prior operativi (v1), informato da letteratura bioimpedenziometrica.
 *
 * **Non è diagnosi clinica** né sostituto di referti specialistici: produce indici 0–1 e bande qualitative
 * per il layer di condizionamento bioenergetico (synthesizer, digest, UI).
 *
 * **Base concettuale (sintesi metodologica):**
 * - **Angolo di fase (PhA, °):** in BIVA / BIA multi-frequenza è associato a geometria vettoriale della
 *   impedenza e, in popolazione, correlato con massa magra / proprietà di membrana; i valori di
 *   riferimento variano fortemente per **età, sesso, etnia e vendor** — qui usiamo midpoint conservativi
 *   adulti e aggiustamento solo per **sesso** se noto.
 * - **ECW/TBW:** rapporto acqua extracellulare / totale; in letteratura clinica e sportiva è usato come
 *   indicatore di spostamento verso il compartimento extracellulare (contesti di congestione / iperidratazione);
 *   in atleti richiede **standardizzazione** (postura, digiuno, timing post-esercizio).
 *
 * Implementazione: soglie lisce, incertezza esplicita (`confidence01`), disclaimer obbligatori.
 */

import type {
  BioenergeticAthletePhenotypeSliceV1,
  BioenergeticBiaCellularGeometryBandV1,
  BioenergeticBiaExtracellularFluidBandV1,
  BioenergeticBiaLiteratureSummaryV1,
  BioenergeticBodyCompositionSnapshotV1,
} from "@empathy/contracts";
import { BIOENERGETIC_BIA_LITERATURE_MODEL_VERSION } from "@empathy/contracts";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Interpolazione lineare; fuori range restituisce estremi. */
function lerpThrough(x: number, x0: number, x1: number, y0: number, y1: number): number {
  if (x <= x0) return y0;
  if (x >= x1) return y1;
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

function midpointPhaseAngleDeg(sex: BioenergeticAthletePhenotypeSliceV1["sex"]): number {
  if (sex === "m") return 6.72;
  if (sex === "f") return 5.88;
  return 6.35;
}

/**
 * ECW/TBW da ratio esplicito o da litri (ECW÷TBW se entrambi > 0).
 * TBW coerente con ECW+ICW quando ICW è nota: TBW = ECW+ICW se manca TBW esplicito.
 */
export function resolveEcwTbwRatio(snapshot: BioenergeticBodyCompositionSnapshotV1): number | undefined {
  const r0 = snapshot.ecwTbwRatio;
  if (typeof r0 === "number" && Number.isFinite(r0) && r0 > 0.08 && r0 < 0.75) return clamp(r0, 0.1, 0.7);

  const ecw = snapshot.ecwL;
  let tbw = snapshot.tbwL;
  const icw = snapshot.icwL;
  if (typeof ecw === "number" && ecw > 0) {
    if ((tbw == null || tbw <= 0) && typeof icw === "number" && icw > 0) {
      tbw = ecw + icw;
    }
    if (typeof tbw === "number" && tbw > ecw * 1.01) {
      const r = ecw / tbw;
      if (Number.isFinite(r) && r > 0.08 && r < 0.75) return clamp(r, 0.1, 0.7);
    }
  }
  return undefined;
}

function cellularGeometryFromPhaseAngle(
  phaseAngleDeg: number,
  sex: BioenergeticAthletePhenotypeSliceV1["sex"],
): { band: BioenergeticBiaCellularGeometryBandV1; supportIndex01: number } {
  const mid = midpointPhaseAngleDeg(sex);
  const supportIndex01 = clamp(lerpThrough(phaseAngleDeg, mid - 2.85, mid + 2.05, 0.18, 0.9), 0.08, 0.95);
  let band: BioenergeticBiaCellularGeometryBandV1;
  if (supportIndex01 < 0.4) band = "low_support_cue";
  else if (supportIndex01 < 0.58) band = "mid";
  else band = "favourable_geometry_cue";
  return { band, supportIndex01 };
}

function extracellularFluidFromRatio(ratio: number): {
  band: BioenergeticBiaExtracellularFluidBandV1;
  loadBias01: number;
} {
  const loadBias01 = clamp(lerpThrough(ratio, 0.33, 0.46, 0.05, 0.95), 0.02, 0.98);
  let band: BioenergeticBiaExtracellularFluidBandV1;
  if (ratio < 0.375) band = "favourable_balance";
  else if (ratio < 0.398) band = "neutral";
  else band = "extracellular_shift_cue";
  return { band, loadBias01 };
}

function qualityConfidenceMultiplier(quality: BioenergeticBodyCompositionSnapshotV1["quality"]): number {
  if (quality === "fasting_morning") return 1.08;
  if (quality === "post_exercise") return 0.72;
  if (quality === "arbitrary") return 0.88;
  return 0.82;
}

export type AnalyzeBioenergeticBiaLiteratureInputV1 = {
  snapshot: BioenergeticBodyCompositionSnapshotV1;
  phenotype?: BioenergeticAthletePhenotypeSliceV1;
};

/**
 * Analisi BIA letteratura v1: sempre definita se `snapshot` è passato (anche con dati parziali).
 */
export function analyzeBioenergeticBiaLiteratureV1(
  input: AnalyzeBioenergeticBiaLiteratureInputV1,
): BioenergeticBiaLiteratureSummaryV1 {
  const { snapshot, phenotype } = input;
  const sex = phenotype?.sex ?? "unknown";

  const pha = snapshot.phaseAngleDeg;
  const ratio = resolveEcwTbwRatio(snapshot);

  const hasPha = typeof pha === "number" && Number.isFinite(pha) && pha > 2 && pha < 14;
  const hasRatio = ratio != null;

  const cellularGeometry = hasPha
    ? (() => {
        const { band, supportIndex01 } = cellularGeometryFromPhaseAngle(pha!, sex);
        return { band, supportIndex01, phaseAngleDegUsed: pha };
      })()
    : {
        band: "insufficient_data" as const,
        supportIndex01: 0.5,
      };

  const extracellularFluid = hasRatio
    ? (() => {
        const { band, loadBias01 } = extracellularFluidFromRatio(ratio!);
        return { band, loadBias01, ecwTbwRatioUsed: ratio };
      })()
    : {
        band: "insufficient_data" as const,
        loadBias01: 0.5,
      };

  let confidence01 = 0.38;
  if (hasPha) confidence01 += 0.22;
  if (hasRatio) confidence01 += 0.2;
  if (hasPha && hasRatio) confidence01 += 0.08;
  confidence01 *= qualityConfidenceMultiplier(snapshot.quality);
  confidence01 = clamp(confidence01, 0.24, 0.92);

  const disclaimersIt = [
    "BIA v1: indici operativi per modellazione piattaforma, non diagnosi clinica né staging patologico.",
    "Angolo di fase e ECW/TBW dipendono da vendor, algoritmo, postura, idratazione acuta e timing rispetto all'allenamento.",
    ...(snapshot.quality === "post_exercise"
      ? ["Misura post-esercizio: interpretazione fluidi / geometria cellulare con incertezza aumentata."]
      : []),
  ];

  const literatureAnchorsIt = [
    "PhA (BIVA/BIA): proxy di geometria impedenziometrica; range normativi variabili per età/sesso/popolazione (letteratura bioimpedenziometrica).",
    "ECW/TBW: rapporto compartimentale usato in valutazione idratazione / congestione in contesti clinici e sportivi, con cautela metodologica.",
    "Modello Empathy v1: soglie lisce + confidence esplicita; non sostituisce DEXA, cateterismo o referto specialistico.",
  ];

  return {
    modelVersion: BIOENERGETIC_BIA_LITERATURE_MODEL_VERSION,
    confidence01: Math.round(confidence01 * 1000) / 1000,
    cellularGeometry,
    extracellularFluid,
    disclaimersIt,
    literatureAnchorsIt,
  };
}
