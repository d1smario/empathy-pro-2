import type { ManualActionCommand } from "@/api/manual-actions/contracts";

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
