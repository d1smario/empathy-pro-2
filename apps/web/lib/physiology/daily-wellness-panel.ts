import type { SupabaseClient } from "@supabase/supabase-js";
import { extractSignalFromDeviceExportRow } from "@/lib/reality/sleep-recovery-signals";
import { buildRecoverySummaryFromRows, type RecoverySummary } from "@/lib/reality/recovery-summary";

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
  /** Serie leggera per grafico notte (0–24 ore frazione o indice campione); opzionale. */
  sleepHypnogram: Array<{ t: number; stage: number }>;
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

function normalizeDayToken(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
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

function mergedPayloadFromExportRow(row: Record<string, unknown>): Record<string, unknown> | null {
  const payload = asRecord(row.payload);
  if (!payload) return null;
  const source = asRecord(payload.sourcePayload);
  const reality = asRecord(payload.realityIngestion);
  const preview = asRecord(reality?.canonicalPreview);
  return { ...payload, ...(source ?? {}), ...(preview ?? {}) };
}

function collectCandidateRecords(payload: Record<string, unknown> | null): Array<Record<string, unknown>> {
  if (!payload) return [];
  const directChildren = Object.values(payload)
    .map((value) => asRecord(value))
    .filter((value): value is Record<string, unknown> => value != null);
  return [payload, ...directChildren];
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
    "start",
    "start_time",
  ];
  for (const rec of collectCandidateRecords(merged)) {
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
  for (const rec of collectCandidateRecords(payload)) {
    out.steps ??= pickNumber(rec, ["steps", "step_count", "total_steps", "steps_count"]);
    out.activeCaloriesKcal ??= pickNumber(rec, [
      "active_energy_kcal",
      "active_calories",
      "active_kilocalories",
      "activeKilocalories",
      "kilojoules",
    ]);
    if (out.activeCaloriesKcal == null) {
      const kj = pickNumber(rec, ["active_kilojoules", "active_energy_kj"]);
      if (kj != null) out.activeCaloriesKcal = Number((kj / 4.184).toFixed(0));
    }
    out.totalCaloriesKcal ??= pickNumber(rec, ["total_calories", "calories_total", "bmr_calories", "calories"]);
    out.respiratoryRateRpm ??= pickNumber(rec, [
      "respiratory_rate",
      "respiratory_rate_rpm",
      "avg_respiratory_rate",
      "respiration_rate",
    ]);
    out.skinTempC ??= pickNumber(rec, ["skin_temperature_c", "skin_temp_c", "skin_temp"]);
    out.bodyTempC ??= pickNumber(rec, [
      "body_temperature_c",
      "wrist_temperature_c",
      "temp_c",
      "temperature_c",
      "avg_skin_temp_c",
    ]);
    out.spo2Pct ??= pickNumber(rec, ["spo2", "average_spo2", "blood_oxygen", "avg_spo2"]);
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

function extractSleepStages(payload: Record<string, unknown> | null): PhysiologyDailyPanelOk["sleepStages"] {
  const empty: PhysiologyDailyPanelOk["sleepStages"] = {
    deepHours: null,
    lightHours: null,
    remHours: null,
    awakeHours: null,
    summaryLabel: null,
  };
  if (!payload) return empty;
  for (const rec of collectCandidateRecords(payload)) {
    const deep =
      pickNumber(rec, ["deep_sleep_duration_hours", "deep_sleep_hours", "deep_sleep_duration"]) ??
      (() => {
        const min = pickNumber(rec, ["deep_sleep_duration_min", "deep_sleep_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })();
    const light =
      pickNumber(rec, ["light_sleep_duration_hours", "light_sleep_hours"]) ??
      (() => {
        const min = pickNumber(rec, ["light_sleep_duration_min", "light_sleep_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })();
    const rem =
      pickNumber(rec, ["rem_duration_hours", "rem_sleep_hours", "rem_sleep_duration_hours"]) ??
      (() => {
        const min = pickNumber(rec, ["rem_duration_min", "rem_sleep_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })();
    const awake =
      pickNumber(rec, ["awake_duration_hours", "awake_time_hours"]) ??
      (() => {
        const min = pickNumber(rec, ["awake_duration_min", "awake_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })();
    const label = typeof rec.sleep_performance === "string" ? rec.sleep_performance : null;
    if (deep != null || light != null || rem != null || awake != null || label) {
      return {
        deepHours: deep,
        lightHours: light,
        remHours: rem,
        awakeHours: awake,
        summaryLabel: typeof label === "string" ? label : null,
      };
    }
  }
  return empty;
}

function tryBuildHypnogram(payload: Record<string, unknown> | null): Array<{ t: number; stage: number }> {
  if (!payload) return [];
  const merged = collectCandidateRecords(payload);
  for (const rec of merged) {
    const phases = rec.sleep_phase_minutes ?? rec.phases_minutes ?? rec.sleep_phases;
    if (Array.isArray(phases) && phases.length > 0) {
      const series: Array<{ t: number; stage: number }> = [];
      let acc = 0;
      for (const chunk of phases) {
        const o = asRecord(chunk);
        if (!o) continue;
        const minutes = asNumber(o.minutes ?? o.duration_min ?? o.m) ?? 0;
        const stage = asNumber(o.stage ?? o.type ?? o.code) ?? 0;
        const start = acc / 60;
        acc += minutes;
        series.push({ t: start, stage });
      }
      if (series.length) return series;
    }
  }
  return [];
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
    if (merged.steps == null && part.steps != null) merged.steps = part.steps;
    if (merged.activeCaloriesKcal == null && part.activeCaloriesKcal != null)
      merged.activeCaloriesKcal = part.activeCaloriesKcal;
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
  const rows = ((exportRows ?? []) as Array<Record<string, unknown>>).filter((row) => {
    const key = wellnessDayKeyFromDeviceExportRow(row);
    return key === date;
  });

  const recoveryRows = rows.filter((row) => {
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

  const recovery = recoveryRows.length ? buildRecoverySummaryFromRows(recoveryRows) : null;
  const activity = mergeActivityFromRows(rows);

  let sleepStages: PhysiologyDailyPanelOk["sleepStages"] = {
    deepHours: null,
    lightHours: null,
    remHours: null,
    awakeHours: null,
    summaryLabel: null,
  };
  let sleepHypnogram: Array<{ t: number; stage: number }> = [];
  for (const row of rows) {
    const p = mergedPayloadFromExportRow(row);
    sleepStages = extractSleepStages(p);
    sleepHypnogram = tryBuildHypnogram(p);
    if (sleepStages.deepHours != null || sleepHypnogram.length) break;
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

  return {
    ok: true,
    date,
    athleteId,
    profileWeightKg,
    recovery,
    activity,
    sleepStages,
    sleepHypnogram,
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
