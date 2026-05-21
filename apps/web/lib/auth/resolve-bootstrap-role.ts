export type AppProfileRole = "private" | "coach";

export type ExistingAppProfileForRole = {
  role: AppProfileRole;
  platform_coach_status?: string | null;
};

/**
 * Ruolo effettivo per bootstrap / ensure-profile da client.
 * - Mai downgrade coach → private da richiesta client (login «Atleta», reload shell).
 * - private → coach consentito (registrazione / scelta accesso coach).
 * - Admin demote usa `POST /api/admin/users/.../app-profile`, non questo helper.
 */
export function resolveBootstrapRole(
  requested: AppProfileRole,
  current: ExistingAppProfileForRole | null,
): AppProfileRole {
  if (!current) return requested;
  if (current.role === "coach") return "coach";
  return requested;
}
