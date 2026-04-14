/**
 * Origine pubblica per redirect Supabase (magic link, password reset, OAuth callback path).
 * In produzione deve coincidere con Site URL / NEXT_PUBLIC_APP_URL.
 */
export function accessAppOriginFromWindow(): string {
  if (typeof window === "undefined") return "";
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv;
  return window.location.origin;
}
