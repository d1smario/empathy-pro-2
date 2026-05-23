import {
  serializePro2BuilderSessionContract,
  type Pro2BuilderSessionContract,
} from "@/lib/training/builder/pro2-session-contract";
import type { PlannedWorkoutInsertPayload } from "@/lib/training/planned/clamp-planned-row";
import { denormalizedFieldsFromContract } from "@/lib/training/library/library-item-from-contract";

const LIBRARY_NOTES_PREFIX = "[PRO2_BUILDER_LIBRARY]";

export function contractToPlannedWorkoutRow(input: {
  athleteId: string;
  date: string;
  contract: Pro2BuilderSessionContract;
  libraryItemId?: string | null;
}): PlannedWorkoutInsertPayload {
  const contract: Pro2BuilderSessionContract = {
    ...input.contract,
    source: "builder",
  };
  const fields = denormalizedFieldsFromContract(contract);
  const jsonLine = serializePro2BuilderSessionContract(contract);
  const meta = {
    v: 1,
    family: fields.family,
    discipline: fields.discipline,
    sessionName: contract.sessionName ?? "",
    libraryItemId: input.libraryItemId?.trim() || null,
  };
  const baseNotes = `${LIBRARY_NOTES_PREFIX}${JSON.stringify(meta)}`;
  let notes = `${baseNotes}\n${jsonLine}`;
  if (notes.length > 32000) {
    notes = notes.slice(0, 32000);
  }
  return {
    athlete_id: input.athleteId.trim(),
    date: input.date.trim().slice(0, 10),
    type: `pro2_builder_${fields.family}`.slice(0, 120),
    duration_minutes: fields.durationMinutes,
    tss_target: fields.tssTarget,
    kcal_target:
      contract.summary?.kcal != null && Number.isFinite(contract.summary.kcal)
        ? Math.round(contract.summary.kcal)
        : null,
    notes,
  };
}
