/**
 * Moduli che **non** devono montare UI dati senza `athleteId` risolto (evita leakage / stato incoerente).
 * Esclusi: home, dashboard, profile (bootstrap), access, marketing, invite.
 */
export function requiresResolvedAthleteForPath(pathname: string): boolean {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (normalized === "/profile" || normalized.startsWith("/profile/")) return false;
  if (normalized === "/access" || normalized.startsWith("/access/")) return false;
  if (normalized === "/invite" || normalized.startsWith("/invite/")) return false;
  if (normalized === "/preview" || normalized.startsWith("/preview/")) return false;
  if (normalized === "/pricing" || normalized.startsWith("/pricing/")) return false;
  if (normalized === "/privacy" || normalized.startsWith("/privacy/")) return false;
  if (normalized === "/" || normalized === "/dashboard" || normalized.startsWith("/dashboard/")) return false;
  const seg = normalized.split("/").filter(Boolean)[0] ?? "";
  return (
    seg === "training" ||
    seg === "nutrition" ||
    seg === "physiology" ||
    seg === "health" ||
    seg === "biomechanics" ||
    seg === "aerodynamics"
  );
}
