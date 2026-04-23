import "server-only";

/**
 * Email con accesso console admin (CSV/semicolon). Default: amministratore progetto.
 * Override in deploy: PLATFORM_ADMIN_EMAILS=m@d1s.ch,altro@dominio.it
 */
export function platformAdminEmailAllowlist(): Set<string> {
  const raw = (process.env.PLATFORM_ADMIN_EMAILS ?? "m@d1s.ch").trim();
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

export function resolvePlatformAdminAccess(input: {
  email: string | null | undefined;
  profileIsAdmin?: boolean | null;
}): boolean {
  if (input.profileIsAdmin === true) return true;
  return isPlatformAdminEmail(input.email);
}
