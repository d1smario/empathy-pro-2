import type { DataSourcePreferenceMap, DataSourceProvider } from "@/lib/integrations/data-source-preference";
import { pickPreferredProvider } from "@/lib/integrations/data-source-preference";
import { mergedPayloadFromExportRow } from "@/lib/physiology/wellness-day-key-from-device-export";
import { extractSignalFromDeviceExportRow, isSleepBearingDevicePayload } from "@/lib/reality/sleep-recovery-signals";

function providerMatches(row: Record<string, unknown>, chosen: DataSourceProvider): boolean {
  const p = typeof row.provider === "string" ? row.provider : "";
  return p === chosen;
}

/** Allineato a `daily-wellness-panel`: riga candidata al blocco recovery (HRV/readiness/sleep score…). */
function isRecoveryCandidateRow(row: Record<string, unknown>): boolean {
  const s = extractSignalFromDeviceExportRow(row);
  return (
    s.sleepScore != null ||
    s.readinessScore != null ||
    s.recoveryScore != null ||
    s.hrvMs != null ||
    s.sleepDurationHours != null ||
    s.restingHrBpm != null
  );
}

function isSleepStructureCandidateRow(row: Record<string, unknown>): boolean {
  const merged = mergedPayloadFromExportRow(row);
  return merged != null && isSleepBearingDevicePayload(merged);
}

/**
 * Filtra `device_sync_exports` in linea con `athlete_data_source_preference` (053):
 * candidato recovery → deve matchare `wellness_recovery`; struttura sonno → `wellness_sleep`;
 * righe che non sono né l’uno né l’altro (es. BIA, power) restano. Combinazione WHOOP
 * recovery+sonno: la riga resta se almeno uno dei due domini scelti matcha (come pannello giornaliero).
 */
export function filterDeviceExportsByAthleteDataSourcePreference(
  rows: Array<Record<string, unknown>>,
  pref: DataSourcePreferenceMap,
): Array<Record<string, unknown>> {
  const preferRecovery = pickPreferredProvider(pref, "wellness_recovery");
  const preferSleep = pickPreferredProvider(pref, "wellness_sleep");
  if (!preferRecovery && !preferSleep) return rows;

  return rows.filter((row) => {
    const recCand = isRecoveryCandidateRow(row);
    const slpCand = isSleepStructureCandidateRow(row);

    if (!recCand && !slpCand) return true;

    const recOk = !preferRecovery || providerMatches(row, preferRecovery);
    const slpOk = !preferSleep || providerMatches(row, preferSleep);

    return (recCand && recOk) || (slpCand && slpOk);
  });
}
