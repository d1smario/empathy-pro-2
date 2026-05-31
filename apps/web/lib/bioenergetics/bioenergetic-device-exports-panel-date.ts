import { wellnessExportMatchesPanelDate } from "@/lib/physiology/wellness-day-key-from-device-export";

/** Esporta per test: filtra export il cui giorno logico o `created_at` coincide con il pannello. */
export function filterDeviceExportsForPanelDate(
  candidates: Array<Record<string, unknown>>,
  panelDate: string,
): Array<Record<string, unknown>> {
  return candidates.filter((row) => {
    if (wellnessExportMatchesPanelDate(row, panelDate)) return true;
    const ca = typeof row.created_at === "string" ? row.created_at : "";
    return ca.slice(0, 10) === panelDate;
  });
}
