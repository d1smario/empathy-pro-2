import "server-only";

/**
 * Contratto **Interpretation (L2)** — memoria intermedia prima del deposito in memoria atleta canonica.
 *
 * Non implementa persistenza: definisce la forma attesa così orchestrazioni multilivello / AI
 * confrontano sorgenti e producono solo **commit espliciti** verso trace / evidence / campi profilo
 * (vedi `docs/PRO2_APPLICATION_READ_SPINE_AND_INTERPRETATION_STAGING.md`, `docs/EMPATHY_LAYER8_SYSTEMIC_MODULATION.md`).
 *
 * Regole: nessun numero canonico di sessione, piano pasti o twin qui; solo proposte strutturate
 * e metadati di confronto per pipeline deterministiche o validazione umana.
 */

/** Riferimento opaco a uno snapshot letto post-`requireAthleteReadContext` (es. hash request + athleteId + timestamp). */
export type InterpretationSourceRef = {
  kind:
    | "athlete_memory"
    | "planned_window"
    | "knowledge_trace"
    | "health_panel"
    | "systemic_modulation_snapshot"
    | "manual";
  label: string;
  /** Es. ISO o id riga; solo per audit/debug, non business logic in UI. */
  ref?: string | null;
};

/** Unità di confronto: cosa l’interprete ritiene allineato / in tensione. */
export type InterpretationStagingFinding = {
  topic: string;
  summary: string;
  sources: InterpretationSourceRef[];
  /** 0–1 opzionale; policy prodotto definisce soglie di commit. */
  confidence?: number | null;
};

/** Payload in **staging**: ancora non scritto in `AthleteMemory` come verità. */
export type InterpretationStagingBundle = {
  athleteId: string;
  createdAtIso: string;
  findings: InterpretationStagingFinding[];
  /** Proposta strutturata verso trace/evidence (shape specifica per feature). */
  proposedStructuredPatches?: Record<string, unknown> | null;
};

/** Esito commit verso store canonico (implementazione futura: API / service). */
export type InterpretationStagingCommitResult =
  | { status: "committed"; target: "athlete_memory_trace" | "evidence" | "profile_audit"; ids: string[] }
  | { status: "rejected"; reason: string }
  | { status: "pending_validation" };
