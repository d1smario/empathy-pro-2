import type {
  SessionGoalRequest,
  TechnicalAthleticQualityId,
  TechnicalGameContext,
  TechnicalModuleFocus,
  TechnicalWorkPhase,
} from "@/lib/training/engine/types";

export const TECHNICAL_ATHLETIC_QUALITY_OPTIONS: { id: TechnicalAthleticQualityId; label: string }[] = [
  { id: "strength", label: "Forza / sollecito" },
  { id: "neuromuscular", label: "Neuromuscolare" },
  { id: "visual_perception", label: "Visione / percezione" },
  { id: "proprioception", label: "Propriocettivo" },
  { id: "coordination", label: "Coordinazione" },
  { id: "spatial_awareness", label: "Senso dello spazio" },
  { id: "game_vision", label: "Visione di gioco" },
  { id: "rhythm_timing", label: "Ritmo e timing" },
  { id: "reactive_agility", label: "Reattività / cambi direzione" },
];

const QUALITY_LABEL = Object.fromEntries(
  TECHNICAL_ATHLETIC_QUALITY_OPTIONS.map((o) => [o.id, o.label]),
) as Record<TechnicalAthleticQualityId, string>;

const WORK_PHASE_IT: Record<TechnicalWorkPhase, string> = {
  technique: "tecnica",
  tactics: "tattica",
};

const GAME_CONTEXT_IT: Record<TechnicalGameContext, string> = {
  defensive: "contesto difensivo",
  build_up: "impostazione / costruzione",
  offensive: "contesto offensivo",
};

const ALL_QUALITY_IDS = new Set<TechnicalAthleticQualityId>(
  TECHNICAL_ATHLETIC_QUALITY_OPTIONS.map((o) => o.id),
);

function phaseContextCue(workPhase: TechnicalWorkPhase): string {
  return workPhase === "tactics"
    ? "Lettura spazi, relazioni e decisioni sotto pressione (qualità esecutiva costante)"
    : "Precisione motoria, ripetizione modulata, feedback tecnico (ridurre rumore decisionale)";
}

/**
 * Unisce il focus modulare C dentro `objectiveDetail` / `intensityHint` per il motore deterministico (stessi campi V1-style).
 */
export function mergeTechnicalFocusIntoGoalRequest(request: SessionGoalRequest): SessionGoalRequest {
  const f = request.technicalModuleFocus;
  if (!f) return request;

  const moduleLine = [
    `Modulo C: ${WORK_PHASE_IT[f.workPhase]}`,
    GAME_CONTEXT_IT[f.gameContext],
  ];
  if (f.athleticQualities.length) {
    moduleLine.push(`qualità: ${f.athleticQualities.map((q) => QUALITY_LABEL[q] ?? q).join(", ")}`);
  }
  const mergedObjective = [request.objectiveDetail?.trim(), moduleLine.join(" · ")]
    .filter((s) => Boolean(s && String(s).trim()))
    .join(" | ");

  const cueTail = phaseContextCue(f.workPhase);
  const mergedHint = [request.intensityHint?.trim(), cueTail].filter(Boolean).join(" · ");

  return {
    ...request,
    objectiveDetail: mergedObjective.trim() || undefined,
    intensityHint: mergedHint.trim() || undefined,
  };
}

export function coerceTechnicalModuleFocus(raw: unknown): TechnicalModuleFocus | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const wp = o.workPhase === "tactics" ? "tactics" : o.workPhase === "technique" ? "technique" : null;
  if (!wp) return undefined;
  const gcRaw = String(o.gameContext ?? "").trim();
  const gc: TechnicalGameContext | null =
    gcRaw === "defensive"
      ? "defensive"
      : gcRaw === "build_up"
        ? "build_up"
        : gcRaw === "offensive"
          ? "offensive"
          : null;
  if (!gc) return undefined;

  let athleticQualities: TechnicalAthleticQualityId[] = [];
  const aq = o.athleticQualities;
  if (Array.isArray(aq)) {
    athleticQualities = aq
      .map((x) => String(x).trim() as TechnicalAthleticQualityId)
      .filter((id): id is TechnicalAthleticQualityId => ALL_QUALITY_IDS.has(id));
  }
  athleticQualities = Array.from(new Set(athleticQualities));

  return { workPhase: wp, gameContext: gc, athleticQualities };
}
