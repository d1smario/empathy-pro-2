/**
 * Origine per redirect Supabase (magic link, signup, reset password, OAuth callback).
 *
 * Su localhost / LAN privata (`192.168.x`, `10.x`, …) usiamo sempre `window.location.origin`:
 * così da telefono (`http://192.168.x.x:3020`) non si mandano redirect verso `NEXT_PUBLIC_APP_URL`
 * tipicamente impostato su `http://localhost:3020` (Supabase rifiuta o il link è inutilizzabile).
 *
 * In produzione (host pubblico) si preferisce `NEXT_PUBLIC_APP_URL` se valorizzato, per allineamento a Site URL.
 */
function isLoopbackOrPrivateLanHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return true;
  const octets = h.split(".").map((x) => Number.parseInt(x, 10));
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function accessAppOriginFromWindow(): string {
  if (typeof window === "undefined") return "";

  const origin = window.location.origin;
  let hostname = "";
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return origin;
  }

  if (isLoopbackOrPrivateLanHostname(hostname)) return origin;

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv;
  return origin;
}
