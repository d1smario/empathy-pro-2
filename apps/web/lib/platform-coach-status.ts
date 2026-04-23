export type PlatformCoachStatus = "pending" | "approved" | "suspended";

export function parsePlatformCoachStatus(raw: string | null | undefined): PlatformCoachStatus | null {
  if (raw === "pending" || raw === "approved" || raw === "suspended") return raw;
  return null;
}

/** Coach operativo su inviti/roster/atleta attivo solo se approvato. */
export function coachOperationalApproved(role: string, status: string | null | undefined): boolean {
  if (role !== "coach") return true;
  return status === "approved";
}
