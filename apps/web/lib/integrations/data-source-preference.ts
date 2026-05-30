/**
 * Athlete data source preference — resolver canonico.
 *
 * Permette al cliente di dichiarare in Settings:
 *   "Sonno → WHOOP", "Recovery/HRV → WHOOP", "Training → Garmin", ecc.
 *
 * I consumer di lettura (daily-wellness-panel, wellness-window-summary,
 * bioenergetic-day-memory-slice, analytics, planned-window) caricano la mappa e
 * filtrano `device_sync_exports.provider` (wellness_sleep / wellness_recovery)
 * oppure il prefisso `executed_workouts.source` (training_activity → `api_sync:<provider>:`).
 *
 * Default: nessuna riga in `athlete_data_source_preference` → comportamento
 * attuale (legge tutti i provider). Niente regressioni se il cliente non sceglie.
 *
 * Migration: `supabase/migrations/053_athlete_data_source_preference.sql`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type DataSourceDomain = "wellness_sleep" | "wellness_recovery" | "training_activity";

export const ALL_DATA_SOURCE_DOMAINS: readonly DataSourceDomain[] = [
  "wellness_sleep",
  "wellness_recovery",
  "training_activity",
];

/**
 * Provider canonici accettati come scelta cliente. Chiave usata per:
 *   - `device_sync_exports.provider` (wellness_sleep, wellness_recovery)
 *   - prefisso `executed_workouts.source` (training_activity → `api_sync:<provider>:…`)
 */
export type DataSourceProvider =
  | "whoop"
  | "garmin"
  | "wahoo"
  | "strava"
  | "polar"
  | "suunto"
  | "hammerhead"
  | "manual"
  | "cgm";

const ALLOWED_PROVIDERS: ReadonlySet<DataSourceProvider> = new Set([
  "whoop",
  "garmin",
  "wahoo",
  "strava",
  "polar",
  "suunto",
  "hammerhead",
  "manual",
  "cgm",
]);

export function isDataSourceDomain(value: unknown): value is DataSourceDomain {
  return typeof value === "string" && (ALL_DATA_SOURCE_DOMAINS as readonly string[]).includes(value);
}

export function isDataSourceProvider(value: unknown): value is DataSourceProvider {
  return typeof value === "string" && ALLOWED_PROVIDERS.has(value as DataSourceProvider);
}

export type DataSourcePreferenceMap = Partial<Record<DataSourceDomain, DataSourceProvider>>;

/**
 * Carica la mappa preferenze del cliente. Mai throw: errori → mappa vuota,
 * la lettura cade sul comportamento default (multi-provider).
 */
export async function loadDataSourcePreferenceMap(
  db: SupabaseClient,
  athleteId: string,
): Promise<DataSourcePreferenceMap> {
  if (!athleteId) return {};
  const { data, error } = await db
    .from("athlete_data_source_preference")
    .select("domain, primary_provider")
    .eq("athlete_id", athleteId);
  if (error || !Array.isArray(data)) return {};

  const out: DataSourcePreferenceMap = {};
  for (const row of data) {
    const domain = (row as { domain?: unknown }).domain;
    const provider = (row as { primary_provider?: unknown }).primary_provider;
    if (isDataSourceDomain(domain) && isDataSourceProvider(provider)) {
      out[domain] = provider;
    }
  }
  return out;
}

/**
 * Read helper sincrono dato un map già caricato.
 * Restituisce `null` se nessuna preferenza esplicita per quel dominio
 * (= il caller NON deve filtrare per provider, comportamento storico).
 */
export function pickPreferredProvider(
  map: DataSourcePreferenceMap,
  domain: DataSourceDomain,
): DataSourceProvider | null {
  return map[domain] ?? null;
}

/**
 * Caso d'uso: filtri Supabase su `device_sync_exports`.
 * Restituisce l'array di provider da passare a `.in("provider", …)` per
 * coprire UN dominio wellness; `null` = nessun filtro (legge tutti).
 *
 * Per wellness_sleep filtra solo sleeps + provider scelto;
 * Per wellness_recovery filtra recovery/HRV + provider scelto.
 *
 * Espone array (non singolo) per consentire policy "WHOOP + manual" in futuro
 * senza cambiare i caller. Oggi sempre array singolo.
 */
export function preferredDeviceExportProviders(
  map: DataSourcePreferenceMap,
  domain: Extract<DataSourceDomain, "wellness_sleep" | "wellness_recovery">,
): string[] | null {
  const p = pickPreferredProvider(map, domain);
  if (!p) return null;
  if (p === "manual") return ["manual"];
  if (p === "cgm") return ["cgm"];
  return [p];
}

/**
 * Caso d'uso: filtro `executed_workouts.source` per training_activity.
 * Le source canoniche sono `api_sync:<provider>:<stream>` o `manual` o `file_import`.
 * Restituisce un array di prefissi accettati; `null` = nessun filtro.
 */
export function preferredExecutedWorkoutSourcePrefixes(map: DataSourcePreferenceMap): string[] | null {
  const p = pickPreferredProvider(map, "training_activity");
  if (!p) return null;
  if (p === "manual") return ["manual", "file_import"];
  return [`api_sync:${p}:`];
}

/** Import espliciti da file: sempre visibili in calendario/analytics (non sono sync device). */
export function isUserFileImportExecutedSource(source: string | null | undefined): boolean {
  if (typeof source !== "string" || source.length === 0) return false;
  return source === "file_import" || source.startsWith("file_import:");
}

/** Vero se la `source` di un executed_workout matcha la preferenza cliente. */
export function executedWorkoutSourceMatchesPreference(
  map: DataSourcePreferenceMap,
  source: string | null | undefined,
): boolean {
  const prefixes = preferredExecutedWorkoutSourcePrefixes(map);
  if (!prefixes) return true;
  if (isUserFileImportExecutedSource(source)) return true;
  if (typeof source !== "string" || source.length === 0) return false;
  for (const prefix of prefixes) {
    if (source === prefix) return true;
    if (source.startsWith(prefix)) return true;
  }
  return false;
}
