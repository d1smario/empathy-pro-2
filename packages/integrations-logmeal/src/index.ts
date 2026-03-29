/**
 * LogMeal Food AI — client e mapping verso @empathy/contracts.
 * @see docs/INTEGRATIONS_LOGMEAL.md
 */
export const INTEGRATION = "@empathy/integrations-logmeal" as const;

export interface LogMealClientConfig {
  apiKey: string;
  baseUrl?: string;
}
