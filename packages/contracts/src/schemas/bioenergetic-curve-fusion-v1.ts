/**
 * Contratto «fusione curve» monitoraggio continuo: motore deterministico / misura Empathy
 * vs proposta AI (futura), arbitrata con pesi espliciti e provenienza.
 *
 * L’AI non genera numeri clinici senza schema validato: questo contratto descrive solo
 * governance e pesi; la curva AI arriverà come payload strutturato separato (stesso digest).
 */

export const BIOENERGETIC_CURVE_FUSION_CONTRACT_VERSION = 1 as const;

export type BioenergeticCurveChannelIdV1 =
  | "glucose"
  | "lactate"
  | "insulin_proxy"
  | "cortisol"
  | "acth"
  | "tsh"
  | "ft4"
  | "gh"
  | "ghrelin"
  | "igf1"
  | "leptin";

/**
 * Chi governa la curva per policy prodotto (prima che esista il merge numerico effettivo).
 * - `measurement_wins`: stream o misure dense Empathy hanno priorità assoluta sul simulatore/AI.
 * - `deterministic_engine_wins`: fase “pareggio / motore”: contesto Empathy ricco → peso sim ≈ peso AI (~50/50 in policy v1).
 * - `ai_proposal_wins_when_available`: fase iniziale su simulatore → quota maggiore al canale AI supervisionato
 *   (curva mostrata resta sim finché manca merge numerico validato).
 */
export type BioenergeticCurveGovernanceHintV1 =
  | "measurement_wins"
  | "deterministic_engine_wins"
  | "ai_proposal_wins_when_available";

export type BioenergeticChannelCurveResolutionV1 = {
  fusionContractVersion: typeof BIOENERGETIC_CURVE_FUSION_CONTRACT_VERSION;
  channelId: BioenergeticCurveChannelIdV1;
  governance: BioenergeticCurveGovernanceHintV1;
  /** Quota motore deterministico o misura Empathy nella sintesi (0–1). */
  deterministicWeight01: number;
  /** Quota proposta AI validata (0–1); oggi tipicamente 0 se il canale non è ancora cablato. */
  aiProposalWeight01: number;
  /** Indice sintetico di ricchezza contesto (pasti macro, sedute, lab, export) per audit. */
  internalContextRichness01: number;
  /** Testo operativo per UI / log (no claim clinico). */
  rationaleIt: string[];
};
