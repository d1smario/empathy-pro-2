/**
 * LogMeal Food AI — client e mapping verso @empathy/contracts.
 * @see docs/INTEGRATIONS_LOGMEAL.md
 */
export const INTEGRATION = "@empathy/integrations-logmeal" as const;

export interface LogMealClientConfig {
  apiKey: string;
  baseUrl?: string;
}

/** Legge env in modo esplicito (chiamare dal server con `process.env` o wrapper test). */
export function logMealConfigFromEnv(get: (key: string) => string | undefined): LogMealClientConfig | null {
  const apiKey = get("LOGMEAL_API_KEY");
  if (!apiKey?.trim()) return null;
  const baseUrl = get("LOGMEAL_API_BASE_URL");
  return {
    apiKey: apiKey.trim(),
    baseUrl: baseUrl?.trim() || undefined,
  };
}
