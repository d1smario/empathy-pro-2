import type { GeneratedSession } from "@/lib/training/engine";

const NOTES_PREFIX = "[PRO2_BUILDER_ENGINE]";

/**
 * Una riga calendario da sessione generata dal builder deterministico.
 * Vyria, import e altri flussi devono convergere su questo mapping (o su contratto serializzato in `notes`).
 */
export function mapEngineSessionToPlannedRow(params: {
  athleteId: string;
  date: string;
  session: GeneratedSession;
  /** Es. riga `BUILDER_SESSION_JSON::…` da accodare (compat V1). */
  extraNotesLines?: string[];
  /** Builder manuale: durata seduta scelta dal coach (override somma blocchi). */
  plannedDurationMinutesOverride?: number | null;
}): {
  athlete_id: string;
  date: string;
  type: string;
  duration_minutes: number;
  tss_target: number;
  kcal_target: number | null;
  notes: string | null;
} {
  const { athleteId, date, session } = params;
  const fromBlocks = session.blocks.reduce((sum, b) => sum + (Number(b.durationMinutes) || 0), 0) || session.blocks.length * 10;
  const override =
    params.plannedDurationMinutesOverride != null &&
    Number.isFinite(Number(params.plannedDurationMinutesOverride)) &&
    Number(params.plannedDurationMinutesOverride) > 0
      ? Math.round(Number(params.plannedDurationMinutesOverride))
      : null;
  const durationMinutes = override ?? fromBlocks;
  const tss =
    session.expectedLoad.tssHint != null && Number.isFinite(session.expectedLoad.tssHint)
      ? Math.round(session.expectedLoad.tssHint)
      : Math.max(20, Math.round(durationMinutes * 0.85));

  const type = `pro2_builder_${session.physiologicalTarget}`.slice(0, 120);

  const meta = {
    v: 1 as const,
    sport: session.sport,
    domain: session.domain,
    goalLabel: session.goalLabel,
    loadBand: session.expectedLoad.loadBand,
    blockLabels: session.blocks.map((b) => b.label),
  };

  const baseNotes = `${NOTES_PREFIX}${JSON.stringify(meta)}`;
  const extra = (params.extraNotesLines ?? []).map((l) => String(l).trim()).filter(Boolean);
  const notes = extra.length > 0 ? [baseNotes, ...extra].join("\n") : baseNotes;

  return {
    athlete_id: athleteId,
    date: date.slice(0, 10),
    type,
    duration_minutes: Math.max(1, Math.round(durationMinutes)),
    tss_target: Math.max(0, tss),
    kcal_target: null,
    notes,
  };
}
