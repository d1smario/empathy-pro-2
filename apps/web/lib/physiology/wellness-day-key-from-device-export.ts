/**
 * Giorno ISO logico per `device_sync_exports` — solo estrazioni pure (no Supabase / server-only),
 * così i test Node non importano `daily-wellness-panel` → `recovery-summary` → `supabase-server`.
 */
import { expandDevicePayloadMetricRecords, extractSignalFromDeviceExportRow } from "@/lib/reality/sleep-recovery-signals";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeDayToken(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function mergedPayloadFromExportRow(row: Record<string, unknown>): Record<string, unknown> | null {
  const payload = asRecord(row.payload);
  if (!payload) return null;
  const source = asRecord(payload.sourcePayload);
  const reality = asRecord(payload.realityIngestion);
  const preview = asRecord(reality?.canonicalPreview);
  return { ...payload, ...(source ?? {}), ...(preview ?? {}) };
}

/**
 * Giorno “logico” del campione (sonno/recovery/riassunto giornaliero), allineato alla cella calendario ISO.
 */
export function wellnessDayKeyFromDeviceExportRow(row: Record<string, unknown>): string | null {
  const sig = extractSignalFromDeviceExportRow(row);
  const d1 = normalizeDayToken(sig.sourceDate);
  if (d1) return d1;

  const merged = mergedPayloadFromExportRow(row);
  if (!merged) {
    const created = row.created_at;
    return typeof created === "string" ? normalizeDayToken(created) : null;
  }

  /** WHOOP (e vendor analoghi): giorno operativo = risveglio → `end` prima di `start`. */
  const keys = [
    "calendar_day",
    "calendarDate",
    "calendar_date",
    "day",
    "date",
    "summary_date",
    "sleep_date",
    "activity_date",
    "recovery_date",
    "end",
    "end_time",
    "start",
    "start_time",
  ];
  for (const rec of expandDevicePayloadMetricRecords(merged)) {
    for (const key of keys) {
      const raw = rec[key];
      if (typeof raw === "string") {
        const d = normalizeDayToken(raw);
        if (d) return d;
      }
    }
  }

  const created = row.created_at;
  if (typeof created === "string") {
    const d = normalizeDayToken(created);
    if (d) return d;
  }
  return null;
}
