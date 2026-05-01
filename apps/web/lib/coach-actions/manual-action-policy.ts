import type { ManualActionCommand } from "@/api/manual-actions/contracts";

/** Cosa resta persistito in modo sicuro quando una manual_action passa a `applied` (migrazione 035+). */
export type AppliedManualActionPersistenceTier =
  | "staging_linked_coach_trace"
  | "coach_trace_module_not_automated";

export function appliedManualActionPersistenceTier(actionType: string): AppliedManualActionPersistenceTier {
  const t = String(actionType ?? "").toLowerCase();
  if (t.includes("staging_patch")) return "staging_linked_coach_trace";
  return "coach_trace_module_not_automated";
}

export function appliedManualActionPersistenceLabelIt(input: {
  actionType: string;
  hasStagingRunId: boolean;
}): string {
  const tier = appliedManualActionPersistenceTier(input.actionType);
  if (tier === "staging_linked_coach_trace") {
    return input.hasStagingRunId
      ? "Memoria coach (tabella trace) + audit commit staging quando collegata alla run."
      : "Memoria coach (tabella trace) per patch da staging; audit staging se presente run_id nel payload.";
  }
  return "Memoria coach (tabella trace); materializzazione automatica modulo-specifica non ancora collegata a questo action_type.";
}

const REQUIRED_FIELDS_BY_TYPE: Record<ManualActionCommand["type"], string[]> = {
  training_file_upload: ["fileName", "source"],
  nutrition_swap: ["mealId", "newFoodItem"],
  physiology_test_entry: ["testName", "value", "unit"],
  biomechanics_test_entry: ["testName", "value"],
  aerodynamics_test_entry: ["testName", "value"],
};

export function validateManualActionCommand(command: ManualActionCommand): string[] {
  const missing: string[] = [];
  const requiredFields = REQUIRED_FIELDS_BY_TYPE[command.type];
  for (const field of requiredFields) {
    if (!(field in command.payload.values)) missing.push(field);
  }
  if (!command.payload.athleteId) missing.push("athleteId");
  if (!command.createdByUserId) missing.push("createdByUserId");
  return missing;
}
