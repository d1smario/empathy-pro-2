import { PENDING_APP_ROLE_COOKIE, type PendingAppRole } from "@/lib/auth/pending-role-cookie";

/** Impostato prima di magic link / registrazione con conferma email; letto da `/auth/callback`. */
export function setPendingAppRoleCookieClient(role: PendingAppRole, maxAgeSec = 900): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PENDING_APP_ROLE_COOKIE}=${role}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
}

export function clearPendingAppRoleCookieClient(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${PENDING_APP_ROLE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
