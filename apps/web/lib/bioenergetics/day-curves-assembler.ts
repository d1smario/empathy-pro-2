import type { ExecutedWorkout } from "@empathy/contracts";
import { averagePowerWattsFromKjAndDuration, kilojoulesFromKcal } from "@empathy/domain-bioenergetics";
import type {
  BioenergeticChannelProvenance,
  BioenergeticDaySeriesChannel,
  BioenergeticSeriesPoint,
} from "@/api/bioenergetics/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { glucosePointsFromPayload, lactatePointsFromPayload, num } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function sortPoints(pts: BioenergeticSeriesPoint[]): BioenergeticSeriesPoint[] {
  return [...pts].sort((a, b) => a.ts.localeCompare(b.ts));
}

/**
 * Estrae punti glucosio/lattato misurati da export giorno + panel lab (stessa logica della route storica).
 */
export function extractMeasuredGluLacFromSlice(slice: BioenergeticDayMemorySlice): {
  glucoseMeasured: BioenergeticSeriesPoint[];
  lactateMeasured: BioenergeticSeriesPoint[];
} {
  const glucoseMeasured: BioenergeticSeriesPoint[] = [];
  const lactateMeasured: BioenergeticSeriesPoint[] = [];

  for (const row of slice.deviceExportRows) {
    const payload = asRecord(row.payload) ?? {};
    const createdAt = typeof row.created_at === "string" ? row.created_at : null;
    const provider = typeof row.provider === "string" ? row.provider : "device";
    if (provider === "cgm") glucoseMeasured.push(...glucosePointsFromPayload(payload, createdAt));
    lactateMeasured.push(...lactatePointsFromPayload(payload, createdAt));
  }

  for (const row of slice.biomarkerRows) {
    const values = asRecord(row.values) ?? {};
    const dateTs =
      typeof row.sample_date === "string" && row.sample_date.trim()
        ? `${row.sample_date}T07:00:00`
        : typeof row.created_at === "string"
          ? row.created_at
          : `${slice.date}T07:00:00`;
    const glucose = num(values.glucose_mmol_l ?? values.glucose_mmol ?? values.glucose);
    const lactate = num(values.lactate_mmol_l ?? values.lactate_mmoll ?? values.lactate);
    if (glucose != null) glucoseMeasured.push({ ts: dateTs, value: glucose, source: "lab_panel" });
    if (lactate != null) lactateMeasured.push({ ts: dateTs, value: lactate, source: "lab_panel" });
  }

  return {
    glucoseMeasured: sortPoints(glucoseMeasured),
    lactateMeasured: sortPoints(lactateMeasured),
  };
}

function mealCarbCumulativeSeries(slice: BioenergeticDayMemorySlice): BioenergeticSeriesPoint[] {
  const rows = [...slice.diaryRows].sort((a, b) => {
    const ta = String(a.entry_time ?? "").localeCompare(String(b.entry_time ?? ""));
    return ta;
  });
  let cum = 0;
  const out: BioenergeticSeriesPoint[] = [];
  for (const row of rows) {
    const t = typeof row.entry_time === "string" && row.entry_time.trim() ? row.entry_time.slice(0, 8) : "12:00:00";
    const c = num(row.carbs_g) ?? 0;
    cum += c;
    out.push({ ts: `${slice.date}T${t}`, value: cum, source: "food_diary" });
  }
  return out;
}

/** Allineato a `import-series-persist.ts` / contratto `ExecutedWorkout.traceSummary`. */
const EXECUTED_TRACE_SCALAR_CHANNELS: Array<{
  id: string;
  labelIt: string;
  unit: string;
  traceKeys: string[];
}> = [
  { id: "power_w", labelIt: "Potenza", unit: "W", traceKeys: ["power_series_w"] },
  { id: "hr_bpm", labelIt: "FC (da seduta)", unit: "bpm", traceKeys: ["hr_series_bpm"] },
  { id: "speed_kmh", labelIt: "Velocità", unit: "km/h", traceKeys: ["speed_series_kmh"] },
  { id: "cadence_rpm", labelIt: "Cadenza", unit: "rpm", traceKeys: ["cadence_series_rpm"] },
  { id: "altitude_m", labelIt: "Quota", unit: "m", traceKeys: ["altitude_series_m", "route_altitude_series_m"] },
  { id: "temperature_c", labelIt: "Temperatura", unit: "°C", traceKeys: ["temperature_series_c"] },
];

function pickNumericSeriesFromTrace(tr: Record<string, unknown>, keys: string[]): number[] | null {
  for (const k of keys) {
    const raw = tr[k];
    if (!Array.isArray(raw) || raw.length < 2) continue;
    const out: number[] = [];
    for (const v of raw) {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
      if (Number.isFinite(n)) out.push(n);
    }
    if (out.length > 1) return out;
  }
  return null;
}

/** Finestra temporale per campioni trace: `started_at`/`ended_at` da DB se validi, altrimenti slot sintetico (stesso schema precedente). */
export function timeWindowMsForExecutedSession(
  ex: Pick<ExecutedWorkout, "startedAt" | "endedAt" | "durationMinutes" | "date">,
  day: string,
  sessionIndexOffset: number,
  sessionIdx: number,
): { startMs: number; spanMs: number } {
  const dm = Math.max(5, Number(ex.durationMinutes) || 60);
  const sAt = ex.startedAt ? Date.parse(ex.startedAt) : NaN;
  const eAt = ex.endedAt ? Date.parse(ex.endedAt) : NaN;
  if (Number.isFinite(sAt) && Number.isFinite(eAt) && eAt > sAt) {
    return { startMs: sAt, spanMs: eAt - sAt };
  }
  const dayKey = day.slice(0, 10);
  const startMin = 7 * 60 + 15 + (sessionIndexOffset + sessionIdx) * 75;
  const capped = Math.min(Math.max(startMin, 6 * 60), 21 * 60);
  const h = Math.floor(capped / 60);
  const m = capped % 60;
  const startIso = `${dayKey}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) {
    const noon = Date.parse(`${dayKey}T12:00:00`);
    return { startMs: Number.isFinite(noon) ? noon : Date.now(), spanMs: dm * 60 * 1000 };
  }
  return { startMs, spanMs: dm * 60 * 1000 };
}

/**
 * Serie da `trace_summary` delle sedute eseguite del giorno.
 * Con `started_at`/`ended_at` popolati (query finestra condivisa), i campioni seguono l’orologio reale della seduta.
 */
function scalarSeriesFromExecuted(
  executed: ExecutedWorkout[],
  date: string,
  sessionIndexOffset: number,
  traceKeys: string[],
): BioenergeticSeriesPoint[] {
  const day = date.slice(0, 10);
  const pts: BioenergeticSeriesPoint[] = [];
  let idx = 0;
  for (const ex of executed) {
    if (String(ex.date).slice(0, 10) !== day) continue;
    const tr = ex.traceSummary;
    if (!tr || typeof tr !== "object") continue;
    const arr = pickNumericSeriesFromTrace(tr as Record<string, unknown>, traceKeys);
    if (!arr) continue;
    const { startMs, spanMs } = timeWindowMsForExecutedSession(ex, day, sessionIndexOffset, idx);
    const stepMs = spanMs / arr.length;
    for (let i = 0; i < arr.length; i += 1) {
      const v = arr[i];
      if (!Number.isFinite(v)) continue;
      pts.push({
        ts: new Date(startMs + i * stepMs).toISOString(),
        value: v,
        source: "executed_trace",
      });
    }
    idx += 1;
  }
  return sortPoints(pts);
}

/**
 * Potenza costante stimata dal piano (`kj_target` o `kcal_target` × 4.184) / durata — stesso dominio numerico
 * usato per confrontare con `power_w` eseguita (overlay concettuale, non FTP prescritto da VIRYA).
 */
function plannedStimulusPowerSeries(slice: BioenergeticDayMemorySlice): BioenergeticSeriesPoint[] {
  const day = slice.date.slice(0, 10);
  const execDay = slice.executed.filter((e) => String(e.date).slice(0, 10) === day);
  const pts: BioenergeticSeriesPoint[] = [];
  let planOrder = 0;
  for (const p of slice.planned) {
    if (String(p.date).slice(0, 10) !== day) continue;
    const kj =
      p.kjTarget != null && Number.isFinite(p.kjTarget) && p.kjTarget > 0
        ? p.kjTarget
        : p.kcalTarget != null && Number.isFinite(p.kcalTarget) && p.kcalTarget > 0
          ? kilojoulesFromKcal(p.kcalTarget)
          : null;
    const watts = kj != null ? averagePowerWattsFromKjAndDuration(kj, p.durationMinutes) : null;
    if (watts == null) {
      planOrder += 1;
      continue;
    }
    const linked = execDay.find((e) => e.plannedWorkoutId === p.id);
    const sessionIdx = linked ? Math.max(0, execDay.indexOf(linked)) : planOrder;
    const windowEx: Pick<ExecutedWorkout, "startedAt" | "endedAt" | "durationMinutes" | "date"> = linked ?? {
      date: day as ExecutedWorkout["date"],
      durationMinutes: p.durationMinutes,
    };
    const { startMs, spanMs } = timeWindowMsForExecutedSession(windowEx, day, 2, sessionIdx);
    const n = Math.max(24, Math.min(360, Math.round((spanMs / (60 * 1000)) * 3)));
    const stepMs = spanMs / n;
    for (let i = 0; i < n; i += 1) {
      pts.push({
        ts: new Date(startMs + i * stepMs).toISOString(),
        value: watts,
        source: "planned_kj_duration",
      });
    }
    planOrder += 1;
  }
  return sortPoints(pts);
}

export type BioenergeticDayCurvesInput = {
  slice: BioenergeticDayMemorySlice;
  provenance: { glucose: BioenergeticChannelProvenance; lactate: BioenergeticChannelProvenance };
  channels: { glucose: BioenergeticSeriesPoint[] | null; lactate: BioenergeticSeriesPoint[] | null };
};

/**
 * Costruisce le serie esposte al client: misurate + proxy pasti + trace eseguito + stimolo potenza da piano.
 */
export function buildBioenergeticDaySeries(input: BioenergeticDayCurvesInput): BioenergeticDaySeriesChannel[] {
  const series: BioenergeticDaySeriesChannel[] = [];
  const g = input.channels.glucose;
  if (g?.length) {
    series.push({
      id: "glucose_mmol",
      labelIt: "Glucosio",
      unit: "mmol/L",
      points: sortPoints(g),
      provenance: input.provenance.glucose,
      sourceHint: "device_sync_exports|biomarker_panels|kernel",
    });
  }
  const l = input.channels.lactate;
  if (l?.length) {
    series.push({
      id: "lactate_mmol",
      labelIt: "Lattato",
      unit: "mmol/L",
      points: sortPoints(l),
      provenance: input.provenance.lactate,
      sourceHint: "device_sync_exports|biomarker_panels|kernel",
    });
  }

  const mealPts = mealCarbCumulativeSeries(input.slice);
  if (mealPts.length) {
    series.push({
      id: "meal_carbs_g_cumulative",
      labelIt: "Carboidrati cumulativi (diario)",
      unit: "g",
      points: mealPts,
      provenance: "measured",
      sourceHint: "food_diary_entries",
    });
  }

  const plannedPower = plannedStimulusPowerSeries(input.slice);
  if (plannedPower.length >= 2) {
    series.push({
      id: "planned_power_w",
      labelIt: "Potenza (target da piano kJ/kcal)",
      unit: "W",
      points: plannedPower,
      provenance: "planned",
      sourceHint: "planned_workouts.kj_target|kcal_target",
    });
  }

  for (const def of EXECUTED_TRACE_SCALAR_CHANNELS) {
    const pts = scalarSeriesFromExecuted(input.slice.executed, input.slice.date, 2, def.traceKeys);
    if (!pts.length) continue;
    series.push({
      id: def.id,
      labelIt: def.labelIt,
      unit: def.unit,
      points: pts,
      provenance: "measured",
      sourceHint: "executed_workouts.trace_summary",
    });
  }

  return series;
}
