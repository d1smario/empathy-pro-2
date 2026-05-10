/**
 * Riassunto compatto wellness/sonno per ciascun giorno della finestra calendario.
 * Pensato per **una sola query** lato server (`device_sync_exports`) e zero N+1
 * lato client: la cella della griglia legge da `wellnessByDate` già pronta.
 *
 * Sorgente: stessa logica di `wellness-day-key-from-device-export.ts` + `extractSignalFromDeviceExportRow`
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractSignalFromDeviceExportRow, isSleepBearingDevicePayload } from "@/lib/reality/sleep-recovery-signals";
import { mergedPayloadFromExportRow, wellnessDayKeyFromDeviceExportRow } from "@/lib/physiology/wellness-day-key-from-device-export";
import {
  loadDataSourcePreferenceMap,
  pickPreferredProvider,
} from "@/lib/integrations/data-source-preference";

export type WellnessDaySummary = {
  date: string;
  sleepHours: number | null;
  hrvMs: number | null;
  restingHrBpm: number | null;
  recoveryScore: number | null;
  readinessScore: number | null;
  sleepScore: number | null;
  sourceProviders: string[];
};

export type WellnessByDateMap = Record<string, WellnessDaySummary>;

function addDaysIso(dateIso: string, delta: number): string {
  const base = new Date(`${dateIso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(base.getTime())) return dateIso.slice(0, 10);
  base.setDate(base.getDate() + delta);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function bestNumber(prev: number | null | undefined, next: number | null | undefined): number | null {
  if (prev != null && Number.isFinite(prev)) return prev;
  if (next != null && Number.isFinite(next)) return next;
  return null;
}

/**
 * Carica `device_sync_exports` per `[from-2g .. to+2g]` (cattura sample logici a cavallo)
 * e ne deriva, per ogni data della finestra `[from..to]`, un riassunto compatto.
 * Letture **read-only**: niente persistenza, niente fetch device-specific.
 */
export async function buildWellnessWindowSummary(input: {
  db: SupabaseClient;
  athleteId: string;
  from: string;
  to: string;
}): Promise<{ wellnessByDate: WellnessByDateMap; rowCount: number }> {
  const { db, athleteId, from, to } = input;
  const scanFrom = addDaysIso(from, -2);
  const scanTo = addDaysIso(to, 2);

  const { data, error } = await db
    .from("device_sync_exports")
    .select("provider, payload, created_at")
    .eq("athlete_id", athleteId)
    .gte("created_at", `${scanFrom}T00:00:00.000Z`)
    .lte("created_at", `${scanTo}T23:59:59.999Z`)
    .order("created_at", { ascending: false })
    .limit(800);

  if (error) {
    return { wellnessByDate: {}, rowCount: 0 };
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const byDate: WellnessByDateMap = {};
  /** Giorni per cui abbiamo già preso HRV dallo stream Garmin `hrv` (priorità su altri export). */
  const hrvFromDedicatedGarminStream = new Set<string>();

  // Preferenze cliente per dominio: se ha scelto WHOOP per recovery, calendario
  // mostra HRV/recovery solo da WHOOP. Default null = comportamento storico (mix).
  const pref = await loadDataSourcePreferenceMap(db, athleteId);
  const preferRecovery = pickPreferredProvider(pref, "wellness_recovery");
  const preferSleep = pickPreferredProvider(pref, "wellness_sleep");

  for (const row of rows) {
    const dayKey = wellnessDayKeyFromDeviceExportRow(row);
    if (!dayKey) continue;
    if (dayKey < from || dayKey > to) continue;
    const sig = extractSignalFromDeviceExportRow(row);
    const provider = typeof row.provider === "string" ? row.provider : "unknown";
    const merged = mergedPayloadFromExportRow(row);
    const src = merged;
    const stream =
      src && typeof src.garmin_wellness_stream === "string" ? src.garmin_wellness_stream.toLowerCase() : "";

    const sleepProviderOk = !preferSleep || provider === preferSleep;
    const recoveryProviderOk = !preferRecovery || provider === preferRecovery;

    const existing = byDate[dayKey] ?? {
      date: dayKey,
      sleepHours: null,
      hrvMs: null,
      restingHrBpm: null,
      recoveryScore: null,
      readinessScore: null,
      sleepScore: null,
      sourceProviders: [] as string[],
    };

    if (sleepProviderOk && merged && isSleepBearingDevicePayload(merged)) {
      const h = sig.sleepDurationHours;
      if (h != null && Number.isFinite(h) && h > 0) {
        existing.sleepHours = existing.sleepHours == null ? h : Math.max(existing.sleepHours, h);
      }
    }

    if (recoveryProviderOk && sig.hrvMs != null && Number.isFinite(sig.hrvMs)) {
      if (stream === "hrv") {
        if (!hrvFromDedicatedGarminStream.has(dayKey)) {
          existing.hrvMs = sig.hrvMs;
          hrvFromDedicatedGarminStream.add(dayKey);
        }
      } else if (!hrvFromDedicatedGarminStream.has(dayKey)) {
        existing.hrvMs = bestNumber(existing.hrvMs, sig.hrvMs);
      }
    }
    if (recoveryProviderOk) {
      existing.restingHrBpm = bestNumber(existing.restingHrBpm, sig.restingHrBpm);
      existing.recoveryScore = bestNumber(existing.recoveryScore, sig.recoveryScore);
      existing.readinessScore = bestNumber(existing.readinessScore, sig.readinessScore);
    }
    if (sleepProviderOk) {
      existing.sleepScore = bestNumber(existing.sleepScore, sig.sleepScore);
    }

    if (provider && !existing.sourceProviders.includes(provider)) {
      existing.sourceProviders.push(provider);
    }

    byDate[dayKey] = existing;
  }

  return { wellnessByDate: byDate, rowCount: rows.length };
}
