import "server-only";

const DEFAULT_PLATFORM_ADMIN_EMAILS = "m@d1s.ch";

/**
 * Email autorizzate alla console admin (virgola o punto e virgola, lowercase).
 * Se `PLATFORM_ADMIN_EMAILS` è assente o vuota dopo trim, si usa il default operativo progetto.
 * In produzione imposta esplicitamente una sola email se l’operatore è uno solo.
 */
export function platformAdminEmailAllowlist(): Set<string> {
  const fromEnv = process.env.PLATFORM_ADMIN_EMAILS?.trim();
  const raw = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_PLATFORM_ADMIN_EMAILS;
  return new Set(
    raw
      .split(/[,;]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return platformAdminEmailAllowlist().has(email.trim().toLowerCase());
}

/**
 * Accesso `/admin` e `/api/admin/*`: richiede **entrambe** le condizioni
 * (email nella allowlist di deploy **e** `is_platform_admin` su `app_user_profiles`).
 * Così un flag DB da solo o una sola email in .env non aprono la console.
 */
export function resolvePlatformAdminAccess(input: {
  email: string | null | undefined;
  profileIsAdmin?: boolean | null;
}): boolean {
  if (!isPlatformAdminEmail(input.email)) return false;
  return input.profileIsAdmin === true;
}
