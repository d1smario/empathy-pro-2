export type ManualActionType =
  | "training_file_upload"
  | "nutrition_swap"
  | "physiology_test_entry"
  | "biomechanics_test_entry"
  | "aerodynamics_test_entry";

export type ManualActionStatus = "pending" | "applied" | "rejected" | "superseded";

export type ManualActionPayload = {
  athleteId: string;
  reason?: string;
  values: Record<string, unknown>;
};

export type ManualActionCommand = {
  id: string;
  type: ManualActionType;
  createdAt: string;
  createdByUserId: string;
  coachScope: "coach" | "private";
  payload: ManualActionPayload;
};

export type ManualActionResult = {
  actionId: string;
  status: ManualActionStatus;
  appliedAt?: string;
  message?: string;
};
