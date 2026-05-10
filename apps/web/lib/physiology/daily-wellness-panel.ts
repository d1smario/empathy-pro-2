import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mergedPayloadFromExportRow,
  wellnessDayKeyFromDeviceExportRow,
  wellnessExportMatchesPanelDate,
} from "@/lib/physiology/wellness-day-key-from-device-export";
import {
  type HypnogramExtraction,
  mergeSleepStageCandidates,
  extractSleepStagesFromDevicePayload,
  extractSleepHypnogramFromDevicePayload,
  extractSleepHypnogramWindowUtc,
} from "@/lib/physiology/sleep-stages-from-device-payload";
import {
  expandDevicePayloadMetricRecords,
  extractSignalFromDeviceExportRow,
  isSleepBearingDevicePayload,
} from "@/lib/reality/sleep-recovery-signals";
import { buildRecoverySummaryFromRows, type RecoverySummary } from "@/lib/reality/recovery-summary";
import {
  loadDataSourcePreferenceMap,
  pickPreferredProvider,
} from "@/lib/integrations/data-source-preference";

/** Re-export storico: alcuni import puntano a `daily-wellness-panel`. */
export { mergedPayloadFromExportRow, wellnessDayKeyFromDeviceExportRow, wellnessExportMatchesPanelDate };

export type PhysiologyDailyPanelOk = {
  ok: true;
  date: string;
  athleteId: string;
  profileWeightKg: number | null;
  recovery: RecoverySummary | null;
  activity: {
    steps: number | null;
    activeCaloriesKcal: number | null;
    totalCaloriesKcal: number | null;
    respiratoryRateRpm: number | null;
    skinTempC: number | null;
    bodyTempC: number | null;
    spo2Pct: number | null;
    ecgCaptured: boolean | null;
  };
  sleepStages: {
    deepHours: number | null;
    lightHours: number | null;
    remHours: number | null;
    awakeHours: number | null;
    summaryLabel: string | null;
  };
  /** Segmenti sonno lungo finestra temporale · t₀,t₁ normalizzati in [0,1]. */
  sleepHypnogram: Array<{ t0: number; t1: number; stage: number }>;
  sleepHypnogramApproximated: boolean;
  sleepHypnogramWindowUtc: { sleepStartUtc: string | null; sleepEndUtc: string | null };
  biomarkers: {
    panelCount: number;
    glucoseMmolL: number | null;
    lactateMmolL: number | null;
    vo2LMin: number | null;
    vco2LMin: number | null;
  };
  labTracksAvailability: {
    glucoseCgm: boolean;
    coreTempContinuous: boolean;
    lactateContinuous: boolean;
    hormonePanels: boolean;
    muscleSmo2Continuous: boolean;
    gasExchangeLab: boolean;
  };
  notes: string[];
  sources: Array<{ provider: string; created_at: string }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(record: Record<string, unknown> | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return null;
}

function addDaysIso(dateIso: string, delta: number): string {
  const base = new Date(`${dateIso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(base.getTime())) return dateIso.slice(0, 10);
  base.setDate(base.getDate() + delta);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function extractActivityWellness(payload: Record<string, unknown> | null): {
  steps: number | null;
  activeCaloriesKcal: number | null;
  totalCaloriesKcal: number | null;
  respiratoryRateRpm: number | null;
  skinTempC: number | null;
  bodyTempC: number | null;
  spo2Pct: number | null;
  ecgCaptured: boolean | null;
} {
  const out = {
    steps: null as number | null,
    activeCaloriesKcal: null as number | null,
    totalCaloriesKcal: null as number | null,
    respiratoryRateRpm: null as number | null,
    skinTempC: null as number | null,
    bodyTempC: null as number | null,
    spo2Pct: null as number | null,
    ecgCaptured: null as boolean | null,
  };
  if (!payload) return out;
  for (const rec of expandDevicePayloadMetricRecords(payload)) {
    out.steps ??= pickNumber(rec, ["steps", "step_count", "total_steps", "steps_count", "Steps"]);
    out.activeCaloriesKcal ??= pickNumber(rec, [
      "active_energy_kcal",
      "active_calories",
      "active_kilocalories",
      "activeKilocalories",
      "ActiveKilocalories",
      "kilojoules",
    ]);
    if (out.activeCaloriesKcal == null) {
      const kj = pickNumber(rec, ["active_kilojoules", "active_energy_kj"]);
      if (kj != null) out.activeCaloriesKcal = Number((kj / 4.184).toFixed(0));
    }
    out.totalCaloriesKcal ??= pickNumber(rec, [
      "total_calories",
      "calories_total",
      "bmr_calories",
      "calories",
      /** Garmin Daily: talvolta solo attive + BMR separati */
      "total_kilocalories",
      "TotalKilocalories",
    ]);
    if (out.totalCaloriesKcal == null) {
      const activeGarmin = pickNumber(rec, ["activeKilocalories", "ActiveKilocalories"]);
      const bmrGarmin = pickNumber(rec, ["bmrKilocalories", "BmrKilocalories"]);
      if (activeGarmin != null && bmrGarmin != null) {
        out.totalCaloriesKcal = Math.round(activeGarmin + bmrGarmin);
      }
    }
    out.respiratoryRateRpm ??= pickNumber(rec, [
      "respiratory_rate",
      "respiratory_rate_rpm",
      "avg_respiratory_rate",
      "respiration_rate",
      /** Garmin Health API (dailies / respiration stream) */
      "avgRespirationRate",
      "maxRespirationRate",
      "AvgRespirationRate",
      "MaxRespirationRate",
    ]);
    out.skinTempC ??= pickNumber(rec, [
      "skin_temperature_c",
      "skin_temp_c",
      "skin_temp",
      "skin_temp_celsius",
      "skin_temperature_celsius",
    ]);
    out.bodyTempC ??= pickNumber(rec, [
      "body_temperature_c",
      "wrist_temperature_c",
      "temp_c",
      "temperature_c",
      "avg_skin_temp_c",
    ]);
    out.spo2Pct ??= pickNumber(rec, ["spo2", "spo2_percentage", "average_spo2", "blood_oxygen", "avg_spo2"]);
    if (out.ecgCaptured == null) {
      const ecg = rec.has_ecg ?? rec.ecg_status ?? rec.ecg_capture;
      if (typeof ecg === "boolean") out.ecgCaptured = ecg;
      else if (typeof ecg === "string" && ecg.trim()) {
        const s = ecg.toLowerCase();
        out.ecgCaptured = s === "complete" || s === "captured" || s === "yes" || s === "true";
      }
    }
  }
  return out;
}

function mergeActivityFromRows(rows: Array<Record<string, unknown>>): PhysiologyDailyPanelOk["activity"] {
  const merged: PhysiologyDailyPanelOk["activity"] = {
    steps: null,
    activeCaloriesKcal: null,
    totalCaloriesKcal: null,
    respiratoryRateRpm: null,
    skinTempC: null,
    bodyTempC: null,
    spo2Pct: null,
    ecgCaptured: null,
  };
  for (const row of rows) {
    const p = mergedPayloadFromExportRow(row);
    const part = extractActivityWellness(p);
    /** Più export `dailies` per lo stesso giorno: prendiamo il massimo passi/kcal (evita “10 passi” da riga parziale). */
    if (part.steps != null) {
      merged.steps = merged.steps == null ? part.steps : Math.max(merged.steps, part.steps);
    }
    if (part.activeCaloriesKcal != null) {
      merged.activeCaloriesKcal =
        merged.activeCaloriesKcal == null
          ? part.activeCaloriesKcal
          : Math.max(merged.activeCaloriesKcal, part.activeCaloriesKcal);
    }
    if (merged.totalCaloriesKcal == null && part.totalCaloriesKcal != null)
      merged.totalCaloriesKcal = part.totalCaloriesKcal;
    if (merged.respiratoryRateRpm == null && part.respiratoryRateRpm != null)
      merged.respiratoryRateRpm = part.respiratoryRateRpm;
    if (merged.skinTempC == null && part.skinTempC != null) merged.skinTempC = part.skinTempC;
    if (merged.bodyTempC == null && part.bodyTempC != null) merged.bodyTempC = part.bodyTempC;
    if (merged.spo2Pct == null && part.spo2Pct != null) merged.spo2Pct = part.spo2Pct;
    if (merged.ecgCaptured == null && part.ecgCaptured != null) merged.ecgCaptured = part.ecgCaptured;
  }
  return merged;
}

/** Somma deep+light+REM (tempo dormito, senza awake) — confrontabile con “ore sonno” KPI. */
function asleepHoursFromSleepStages(stages: PhysiologyDailyPanelOk["sleepStages"]): number | null {
  if (stages.deepHours == null && stages.lightHours == null && stages.remHours == null) return null;
  return (stages.deepHours ?? 0) + (stages.lightHours ?? 0) + (stages.remHours ?? 0);
}

/**
 * Picka la durata sonno dalla riga **sleep-bearing** del giorno (Garmin sleeps stream o WHOOP sleep)
 * con valore più alto = main sleep, NON dai naps né da preview corrotti calcolati da `dailies` /
 * `allDayRespiration` (vecchi push pre-fix `looksLikeGarminSleepRecord` salvavano `sleep_duration_hours`
 * dal `durationInSeconds` di payload non-sleep, contaminando il KPI).
 *
 * Restituisce `null` se nessuna riga è veramente sleep-bearing → il caller cade su altre fonti
 * (somma stadi, valore aggregato precedente).
 */
function pickMainSleepDurationHoursFromSleepRows(rows: Array<Record<string, unknown>>): number | null {
  let best: number | null = null;
  for (const row of rows) {
    const merged = mergedPayloadFromExportRow(row);
    if (!isSleepBearingDevicePayload(merged)) continue;
    const sig = extractSignalFromDeviceExportRow(row);
    const h = sig.sleepDurationHours;
    if (h == null || !Number.isFinite(h) || h <= 0) continue;
    if (best == null || h > best) best = h;
  }
  return best != null ? Number(best.toFixed(2)) : null;
}

/**
 * Allinea il KPI `sleepDurationHours` del recovery summary alla realtà del giorno:
 *   1. main sleep entry (Garmin `sleeps` / WHOOP sleep) — fonte canonica;
 *   2. fallback: somma stadi (deep+light+REM) se molto sopra il valore mediato corrente.
 */
function alignRecoverySleepDurationWithStages(
  recovery: RecoverySummary | null,
  stages: PhysiologyDailyPanelOk["sleepStages"],
  rows: Array<Record<string, unknown>>,
): RecoverySummary | null {
  if (!recovery) return null;

  const mainSleepHours = pickMainSleepDurationHoursFromSleepRows(rows);
  if (mainSleepHours != null) {
    return { ...recovery, sleepDurationHours: mainSleepHours };
  }

  const asleep = asleepHoursFromSleepStages(stages);
  if (asleep == null || asleep < 1) return recovery;
  const cur = recovery.sleepDurationHours;
  if (cur == null) {
    return { ...recovery, sleepDurationHours: Number(asleep.toFixed(2)) };
  }
  if (asleep - cur >= 1.25) {
    return { ...recovery, sleepDurationHours: Number(asleep.toFixed(2)) };
  }
  return recovery;
}

/**
 * `buildRecoverySummaryFromRows` media solo le prime 3 righe recovery-like: se l'HRV Garmin
 * (`stream=hrv`) è più indietro nel tempo, il KPI resta vuoto mentre il calendario (che scansiona
 * tutte le righe) mostra HRV. Allineiamo: prima riga con `garmin_wellness_stream=hrv` nel giorno.
 */
function alignRecoveryHrvFromGarminStream(
  recovery: RecoverySummary | null,
  rows: Array<Record<string, unknown>>,
): RecoverySummary | null {
  if (!recovery || recovery.hrvMs != null) return recovery;
  for (const row of rows) {
    const merged = mergedPayloadFromExportRow(row);
    const stream =
      merged && typeof merged.garmin_wellness_stream === "string"
        ? merged.garmin_wellness_stream.toLowerCase()
        : "";
    if (stream !== "hrv") continue;
    const s = extractSignalFromDeviceExportRow(row);
    if (s.hrvMs != null && Number.isFinite(s.hrvMs)) {
      return { ...recovery, hrvMs: s.hrvMs };
    }
  }
  return recovery;
}

function pickGlucoseMmol(values: Record<string, unknown>): number | null {
  const mmol = pickNumber(values, ["glucose_mmol_l", "glucose_mmol", "blood_glucose_mmol"]);
  if (mmol != null) return mmol;
  const mg = pickNumber(values, ["glucose_mg_dl", "glucose_mgdl", "blood_glucose_mg_dl"]);
  if (mg != null) return Number((mg / 18).toFixed(2));
  return null;
}

function scanLabAvailability(values: Record<string, unknown>): PhysiologyDailyPanelOk["labTracksAvailability"] {
  const keys = Object.keys(values).map((k) => k.toLowerCase());
  const joined = keys.join("|");
  return {
    glucoseCgm: joined.includes("glucose") || joined.includes("cgm") || joined.includes("glycemic"),
    coreTempContinuous: joined.includes("core_temp") || joined.includes("core temperature"),
    lactateContinuous: joined.includes("lactate"),
    hormonePanels:
      joined.includes("cortisol") ||
      joined.includes("testosterone") ||
      joined.includes("estradiol") ||
      joined.includes("hormone"),
    muscleSmo2Continuous: joined.includes("smo2") || joined.includes("nirs") || joined.includes("muscle o2"),
    gasExchangeLab: joined.includes("vo2") || joined.includes("vco2") || joined.includes("rer"),
  };
}

export async function buildPhysiologyDailyPanel(input: {
  db: SupabaseClient;
  athleteId: string;
  date: string;
}): Promise<PhysiologyDailyPanelOk> {
  const { db, athleteId, date } = input;
  const notes: string[] = [];

  const { data: profileRow } = await db
    .from("athlete_profiles")
    .select("weight_kg")
    .eq("id", athleteId)
    .maybeSingle();

  const weightRaw = profileRow && typeof profileRow === "object" ? (profileRow as { weight_kg?: unknown }).weight_kg : null;
  const profileWeightKg = asNumber(weightRaw);

  const scanFrom = addDaysIso(date, -12);
  const scanTo = addDaysIso(date, 4);

  const { data: exportRows, error: exErr } = await db
    .from("device_sync_exports")
    .select("provider, payload, created_at")
    .eq("athlete_id", athleteId)
    .gte("created_at", `${scanFrom}T00:00:00.000Z`)
    .lte("created_at", `${scanTo}T23:59:59.999Z`)
    .order("created_at", { ascending: false })
    .limit(220);

  if (exErr) {
    notes.push(`device_sync_exports: ${exErr.message}`);
  }

  const rawExportCount = (exportRows ?? []).length;
  const rows = ((exportRows ?? []) as Array<Record<string, unknown>>).filter((row) =>
    wellnessExportMatchesPanelDate(row, date),
  );

  // Preferenze provider per dominio (Settings → Devices). Se l'atleta ha scelto
  // "WHOOP per recovery" / "Garmin per sonno", filtriamo qui le righe candidate
  // ai consumer (recovery summary, sleep stages/hypnogram). I passi/calorie
  // attivi (`activity`) restano cross-provider: tipicamente solo Garmin li scrive.
  const pref = await loadDataSourcePreferenceMap(db, athleteId);
  const preferRecovery = pickPreferredProvider(pref, "wellness_recovery");
  const preferSleep = pickPreferredProvider(pref, "wellness_sleep");

  const matchesProvider = (row: Record<string, unknown>, provider: string): boolean => {
    const p = (row as { provider?: unknown }).provider;
    return typeof p === "string" && p === provider;
  };

  const recoveryRowsAll = rows.filter((row) => {
    const s = extractSignalFromDeviceExportRow(row);
    return (
      s.sleepScore != null ||
      s.readinessScore != null ||
      s.recoveryScore != null ||
      s.hrvMs != null ||
      s.sleepDurationHours != null ||
      s.restingHrBpm != null
    );
  });
  const recoveryRows = preferRecovery
    ? recoveryRowsAll.filter((row) => matchesProvider(row, preferRecovery))
    : recoveryRowsAll;

  const recovery = recoveryRows.length ? buildRecoverySummaryFromRows(recoveryRows) : null;
  const activity = mergeActivityFromRows(rows);

  const sleepStagesEmpty: PhysiologyDailyPanelOk["sleepStages"] = {
    deepHours: null,
    lightHours: null,
    remHours: null,
    awakeHours: null,
    summaryLabel: null,
  };

  const sleepCandidateRows = preferSleep
    ? rows.filter((row) => matchesProvider(row, preferSleep))
    : rows;

  let sleepStages: PhysiologyDailyPanelOk["sleepStages"] = { ...sleepStagesEmpty };
  for (const row of sleepCandidateRows) {
    const p = mergedPayloadFromExportRow(row);
    sleepStages = mergeSleepStageCandidates(sleepStages, extractSleepStagesFromDevicePayload(p));
  }

  let sleepHypnogram: PhysiologyDailyPanelOk["sleepHypnogram"] = [];
  let sleepHypnogramApproximated = false;
  let sleepHypnogramWindowUtc: PhysiologyDailyPanelOk["sleepHypnogramWindowUtc"] = {
    sleepStartUtc: null,
    sleepEndUtc: null,
  };

  let bestHyp: HypnogramExtraction | null = null;
  for (const row of sleepCandidateRows) {
    const p = mergedPayloadFromExportRow(row);
    if (!p) continue;
    const ex = extractSleepHypnogramFromDevicePayload(p, sleepStages);
    if (!ex.segments.length) continue;
    const win = extractSleepHypnogramWindowUtc(p);
    if (ex.kind === "phases") {
      bestHyp = ex;
      sleepHypnogramWindowUtc = win;
      break;
    }
    if (!bestHyp || bestHyp.kind === "approximated") {
      bestHyp = ex;
      sleepHypnogramWindowUtc = win;
    }
  }
  if (bestHyp) {
    sleepHypnogram = bestHyp.segments;
    sleepHypnogramApproximated = bestHyp.kind === "approximated";
  }

  const { data: bioRows, error: bioErr } = await db
    .from("biomarker_panels")
    .select("values")
    .eq("athlete_id", athleteId)
    .eq("sample_date", date)
    .limit(12);

  if (bioErr) {
    notes.push(`biomarker_panels: ${bioErr.message}`);
  }

  const panels = (bioRows ?? []) as Array<{ values?: unknown }>;
  let glucoseMmolL: number | null = null;
  let lactateMmolL: number | null = null;
  let vo2LMin: number | null = null;
  let vco2LMin: number | null = null;
  const labTracks: PhysiologyDailyPanelOk["labTracksAvailability"] = {
    glucoseCgm: false,
    coreTempContinuous: false,
    lactateContinuous: false,
    hormonePanels: false,
    muscleSmo2Continuous: false,
    gasExchangeLab: false,
  };

  for (const panel of panels) {
    const v = asRecord(panel.values);
    if (!v) continue;
    const g = pickGlucoseMmol(v);
    if (glucoseMmolL == null && g != null) glucoseMmolL = g;
    lactateMmolL ??= pickNumber(v, ["lactate_mmol_l", "blood_lactate_mmol", "lactate"]);
    vo2LMin ??= pickNumber(v, ["vo2_l_min", "vo2_steady_l_min"]);
    vco2LMin ??= pickNumber(v, ["vco2_l_min", "vco2_steady_l_min"]);
    const flags = scanLabAvailability(v);
    labTracks.glucoseCgm ||= flags.glucoseCgm;
    labTracks.coreTempContinuous ||= flags.coreTempContinuous;
    labTracks.lactateContinuous ||= flags.lactateContinuous;
    labTracks.hormonePanels ||= flags.hormonePanels;
    labTracks.muscleSmo2Continuous ||= flags.muscleSmo2Continuous;
    labTracks.gasExchangeLab ||= flags.gasExchangeLab;
  }

  if (rawExportCount > 0 && rows.length === 0) {
    notes.push(
      "Export device presenti nel periodo di scansione ma nessuno mappato a questa data (controlla `source_date` / payload).",
    );
  }

  if (!rows.length && !panels.length && profileWeightKg == null) {
    notes.push(
      "Nessun export device né biomarker per questa data: collega WHOOP/Garmin o carica pannelli Health con `sample_date` allineato.",
    );
  }

  const sources = rows.map((row) => ({
    provider: typeof row.provider === "string" ? row.provider : "unknown",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  }));

  const recoveryAligned = alignRecoveryHrvFromGarminStream(
    alignRecoverySleepDurationWithStages(recovery, sleepStages, rows),
    rows,
  );

  return {
    ok: true,
    date,
    athleteId,
    profileWeightKg,
    recovery: recoveryAligned,
    activity,
    sleepStages,
    sleepHypnogram,
    sleepHypnogramApproximated,
    sleepHypnogramWindowUtc,
    biomarkers: {
      panelCount: panels.length,
      glucoseMmolL,
      lactateMmolL,
      vo2LMin,
      vco2LMin,
    },
    labTracksAvailability: labTracks,
    notes,
    sources,
  };
}
