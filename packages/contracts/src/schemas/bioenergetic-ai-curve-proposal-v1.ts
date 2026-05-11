/**
 * Proposta strutturata (futura supervisione) per merge numerico su curve orarie 0–23.
 * Validazione solo a boundary (route / use-case); merge in `domain-bioenergetics`.
 */

export const BIOENERGETIC_AI_CURVE_PROPOSAL_CONTRACT_VERSION = 1 as const;

export type BioenergeticAiCurveProposalChannelV1 = "glucose" | "lactate";

export type BioenergeticAiCurveProposalV1 = {
  contractVersion: typeof BIOENERGETIC_AI_CURVE_PROPOSAL_CONTRACT_VERSION;
  channelId: BioenergeticAiCurveProposalChannelV1;
  unit: string;
  /** Esattamente 24 valori numerici finiti (ore 0–23, stesso asse del monitoraggio continuo giornaliero). */
  hourly24: readonly number[];
  /** Opzionale: riferimento audit (hash, id job); non entra nel merge. */
  proposalRef?: string | null;
};

export function parseBioenergeticAiCurveProposalV1(
  raw: unknown,
  expectedChannel: BioenergeticAiCurveProposalChannelV1,
):
  | { ok: true; value: BioenergeticAiCurveProposalV1 }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "proposal_not_object" };
  }
  const o = raw as Record<string, unknown>;
  if (o.contractVersion !== BIOENERGETIC_AI_CURVE_PROPOSAL_CONTRACT_VERSION) {
    return { ok: false, error: "contract_version" };
  }
  if (o.channelId !== expectedChannel) return { ok: false, error: "channel_mismatch" };
  const unit = typeof o.unit === "string" ? o.unit.trim() : "";
  if (!unit) return { ok: false, error: "unit" };
  if (!Array.isArray(o.hourly24) || o.hourly24.length !== 24) return { ok: false, error: "hourly24" };
  const hourly24: number[] = [];
  for (let i = 0; i < 24; i += 1) {
    const v = o.hourly24[i];
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return { ok: false, error: `hour_${i}` };
    hourly24.push(n);
  }
  let proposalRef: string | null = null;
  if (o.proposalRef != null && String(o.proposalRef).trim()) {
    proposalRef = String(o.proposalRef).trim().slice(0, 256);
  }
  return {
    ok: true,
    value: {
      contractVersion: BIOENERGETIC_AI_CURVE_PROPOSAL_CONTRACT_VERSION,
      channelId: expectedChannel,
      unit,
      hourly24,
      proposalRef,
    },
  };
}
