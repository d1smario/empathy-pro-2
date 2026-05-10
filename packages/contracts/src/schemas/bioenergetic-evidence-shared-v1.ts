/**
 * EMPATHY Pro 2 — Bioenergetic evidence curve contract (shared primitives).
 *
 * Reality > scenario: prior e contesto «evidenza condizionata» non sostituiscono
 * misure cliniche o stream device quando presenti.
 *
 * @see BIOENERGETIC_EVIDENCE_CURVE_CONTRACT_VERSION in bioenergetic-evidence-curve-v1.ts
 */

/** Identificativo analita / canale; prefisso `custom:` per estensioni senza bump majore. */
export type BioenergeticAnalyteIdV1 = string;

/** Incertezza decomposta (24h; campi opzionali secondo banco / synthesizer). */
export type BioenergeticUncertaintyDecompositionV1 = {
  aleatoricSd24?: number[];
  epistemicSd24?: number[];
  contextImputationSd24?: number[];
  combinedLow24?: number[];
  combinedHigh24?: number[];
};
