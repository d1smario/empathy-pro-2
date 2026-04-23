/** Cookie letto da `/auth/callback` dopo magic link (impostato dal client su `/access`). */
export const PENDING_APP_ROLE_COOKIE = "empathy_pending_app_role";

export type PendingAppRole = "private" | "coach";

export function parsePendingAppRole(raw: string | undefined | null): PendingAppRole | null {
  if (raw === "coach" || raw === "private") return raw;
  return null;
}
