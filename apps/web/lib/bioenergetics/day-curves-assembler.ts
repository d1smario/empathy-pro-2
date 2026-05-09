import type { ExecutedWorkout } from "@empathy/contracts";
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

function hrSeriesFromExecuted(executed: ExecutedWorkout[], date: string, sessionIndexOffset: number): BioenergeticSeriesPoint[] {
  const day = date.slice(0, 10);
  const pts: BioenergeticSeriesPoint[] = [];
  let idx = 0;
  for (const ex of executed) {
    if (String(ex.date).slice(0, 10) !== day) continue;
    const tr = ex.traceSummary;
    if (!tr || typeof tr !== "object") continue;
    const arr = (tr as Record<string, unknown>).hr_series_bpm;
    if (!Array.isArray(arr) || arr.length < 2) continue;
    const dm = Math.max(5, Number(ex.durationMinutes) || 60);
    const startMin = 7 * 60 + 15 + (sessionIndexOffset + idx) * 75;
    const capped = Math.min(Math.max(startMin, 6 * 60), 21 * 60);
    const h = Math.floor(capped / 60);
    const m = capped % 60;
    const startIso = `${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
    const startMs = Date.parse(startIso);
    if (Number.isNaN(startMs)) continue;
    const stepMs = (dm * 60 * 1000) / arr.length;
    for (let i = 0; i < arr.length; i += 1) {
      const v = Number(arr[i]);
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

export type BioenergeticDayCurvesInput = {
  slice: BioenergeticDayMemorySlice;
  provenance: { glucose: BioenergeticChannelProvenance; lactate: BioenergeticChannelProvenance };
  channels: { glucose: BioenergeticSeriesPoint[] | null; lactate: BioenergeticSeriesPoint[] | null };
};

/**
 * Costruisce le serie esposte al client: misurate + proxy pasti + HR da trace se disponibile.
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

  const hrPts = hrSeriesFromExecuted(input.slice.executed, input.slice.date, 2);
  if (hrPts.length) {
    series.push({
      id: "hr_bpm",
      labelIt: "FC (da seduta)",
      unit: "bpm",
      points: hrPts,
      provenance: "measured",
      sourceHint: "executed_workouts.trace_summary",
    });
  }

  return series;
}
