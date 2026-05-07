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

/** ISO calendar day shift (UTC noon anchor) for pairing WHOOP sleep-start vs recovery-scored day. */
function addDaysIso(dateIso: string, deltaDays: number): string {
  const day = dateIso.slice(0, 10);
  const base = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return day;
  base.setUTCDate(base.getUTCDate() + deltaDays);
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, "0");
  const d = String(base.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const merged = mergedPayloadFromExportRow(row);

  if (merged) {
    const whoopSleep = asRecord(merged.whoop_sleep);
    if (whoopSleep) {
      const startDay = normalizeDayToken(typeof whoopSleep.start === "string" ? whoopSleep.start : undefined);
      if (startDay) return startDay;
      const endDay = normalizeDayToken(typeof whoopSleep.end === "string" ? whoopSleep.end : undefined);
      if (endDay) return endDay;
    }

    const whoopRecovery = asRecord(merged.whoop_recovery);
    if (whoopRecovery) {
      const createdDay = normalizeDayToken(typeof whoopRecovery.created_at === "string" ? whoopRecovery.created_at : undefined);
      if (createdDay) return createdDay;
      const cycleEnd = normalizeDayToken(typeof whoopRecovery.cycle_end_time === "string" ? whoopRecovery.cycle_end_time : undefined);
      if (cycleEnd) return cycleEnd;
      const cycleStart = normalizeDayToken(typeof whoopRecovery.cycle_start_time === "string" ? whoopRecovery.cycle_start_time : undefined);
      if (cycleStart) return cycleStart;
    }
  }

  const sig = extractSignalFromDeviceExportRow(row);
  const d1 = normalizeDayToken(sig.sourceDate);
  if (d1) return d1;

  if (!merged) {
    const created = row.created_at;
    return typeof created === "string" ? normalizeDayToken(created) : null;
  }

  /** Garmin e vendor generici: giorno operativo ≈ risveglio → `end` prima di `start`. */
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

/**
 * Include export nella cella giornaliera ISO richiesta: match diretto + accoppiamento WHOOP sonno↔recovery su giorni adiacenti.
 */
export function wellnessExportMatchesPanelDate(row: Record<string, unknown>, panelDate: string): boolean {
  const key = wellnessDayKeyFromDeviceExportRow(row);
  if (!key) return false;
  if (key === panelDate) return true;
  const provider = typeof row.provider === "string" ? row.provider : "";
  if (provider !== "whoop") return false;
  const m = mergedPayloadFromExportRow(row);
  if (!m) return false;
  if (asRecord(m.whoop_sleep)) {
    return key === addDaysIso(panelDate, -1);
  }
  if (asRecord(m.whoop_recovery)) {
    return key === addDaysIso(panelDate, 1);
  }
  return false;
}
