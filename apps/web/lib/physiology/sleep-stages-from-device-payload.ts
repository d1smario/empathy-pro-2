/**
 * Ore per stadio di sonno + ipnogramma da payload vendor (WHOOP v2 `score.stage_summary`, Garmin, ecc.).
 * Logica pura — importabile dai test senza `daily-wellness-panel` / Supabase.
 */
import { expandDevicePayloadMetricRecords } from "@/lib/reality/sleep-recovery-signals";

export type SleepStageHours = {
  deepHours: number | null;
  lightHours: number | null;
  remHours: number | null;
  awakeHours: number | null;
  summaryLabel: string | null;
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

function hoursFromSleepMilli(record: Record<string, unknown>, keys: string[]): number | null {
  const milli = pickNumber(record, keys);
  if (milli == null || milli <= 0) return null;
  return Number((milli / 3_600_000).toFixed(2));
}

function sleepStageFieldCount(s: SleepStageHours): number {
  return [s.deepHours, s.lightHours, s.remHours, s.awakeHours].filter((x) => x != null).length;
}

/** Unisce più estrazioni vendor (priorità alla riga più completa per ore stadio). */
export function mergeSleepStageCandidates(a: SleepStageHours, b: SleepStageHours): SleepStageHours {
  const ra = sleepStageFieldCount(a);
  const rb = sleepStageFieldCount(b);
  const primary = rb > ra ? b : a;
  const secondary = rb > ra ? a : b;
  return {
    deepHours: primary.deepHours ?? secondary.deepHours,
    lightHours: primary.lightHours ?? secondary.lightHours,
    remHours: primary.remHours ?? secondary.remHours,
    awakeHours: primary.awakeHours ?? secondary.awakeHours,
    summaryLabel: primary.summaryLabel ?? secondary.summaryLabel,
  };
}

/** WHOOP v2: https://developer.whoop.com/docs/developing/user-data/sleep — `stage_summary` usa prefissi `total_*`. */
export function extractSleepStagesFromDevicePayload(payload: Record<string, unknown> | null): SleepStageHours {
  const empty: SleepStageHours = {
    deepHours: null,
    lightHours: null,
    remHours: null,
    awakeHours: null,
    summaryLabel: null,
  };
  if (!payload) return empty;

  let acc = empty;

  for (const rec of expandDevicePayloadMetricRecords(payload)) {
    const deep =
      pickNumber(rec, ["deep_sleep_duration_hours", "deep_sleep_hours", "deep_sleep_duration"]) ??
      (() => {
        const min = pickNumber(rec, ["deep_sleep_duration_min", "deep_sleep_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })() ??
      (() => {
        const sec = pickNumber(rec, ["deepSleepDurationInSeconds"]);
        return sec != null && sec > 0 ? Number((sec / 3600).toFixed(2)) : null;
      })() ??
      hoursFromSleepMilli(rec, [
        "slow_wave_sleep_time_milli",
        "total_slow_wave_sleep_time_milli",
        "deep_sleep_duration_milli",
      ]);
    const light =
      pickNumber(rec, ["light_sleep_duration_hours", "light_sleep_hours"]) ??
      (() => {
        const min = pickNumber(rec, ["light_sleep_duration_min", "light_sleep_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })() ??
      (() => {
        const sec = pickNumber(rec, ["lightSleepDurationInSeconds"]);
        return sec != null && sec > 0 ? Number((sec / 3600).toFixed(2)) : null;
      })() ??
      hoursFromSleepMilli(rec, ["light_sleep_time_milli", "total_light_sleep_time_milli"]);
    const rem =
      pickNumber(rec, ["rem_duration_hours", "rem_sleep_hours", "rem_sleep_duration_hours"]) ??
      (() => {
        const min = pickNumber(rec, ["rem_duration_min", "rem_sleep_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })() ??
      (() => {
        const sec = pickNumber(rec, ["remSleepInSeconds", "rem_sleep_duration_seconds"]);
        return sec != null && sec > 0 ? Number((sec / 3600).toFixed(2)) : null;
      })() ??
      hoursFromSleepMilli(rec, ["rem_sleep_time_milli", "total_rem_sleep_time_milli"]);
    const awake =
      pickNumber(rec, ["awake_duration_hours", "awake_time_hours"]) ??
      (() => {
        const min = pickNumber(rec, ["awake_duration_min", "awake_minutes"]);
        return min != null ? Number((min / 60).toFixed(2)) : null;
      })() ??
      (() => {
        const sec = pickNumber(rec, ["awakeDurationInSeconds"]);
        return sec != null && sec > 0 ? Number((sec / 3600).toFixed(2)) : null;
      })() ??
      hoursFromSleepMilli(rec, ["wake_duration_milli", "awake_time_milli", "total_awake_time_milli"]);
    const perfPct = pickNumber(rec, ["sleep_performance_percentage"]);
    const labelStr = typeof rec.sleep_performance === "string" ? rec.sleep_performance.trim() : "";
    const summaryLabel = labelStr || (perfPct != null ? `${Math.round(perfPct)}% sleep` : null);

    const candidate: SleepStageHours = {
      deepHours: deep,
      lightHours: light,
      remHours: rem,
      awakeHours: awake,
      summaryLabel,
    };

    if (sleepStageFieldCount(candidate) > 0 || summaryLabel) {
      acc = mergeSleepStageCandidates(acc, candidate);
    }
  }

  return sleepStageFieldCount(acc) > 0 || acc.summaryLabel ? acc : empty;
}

/** Asse canonico grafico · fasi: awake=0 · light=1 · deep=2 · rem=3 */
export type SleepHypnogramSegment = {
  t0: number;
  t1: number;
  stage: number;
};

export type HypnogramExtraction =
  | { kind: "phases"; segments: SleepHypnogramSegment[] }
  | { kind: "approximated"; segments: SleepHypnogramSegment[] };

function coerceSleepStage(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n >= 0 && n <= 3) return n;
    return null;
  }
  const s =
    typeof value === "string"
      ? value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_")
      : "";
  if (!s) return null;
  if (s.includes("wake") || s === "awake" || s === "awakening" || s === "wakeful") return 0;
  if (s.includes("rem")) return 3;
  if (s.includes("deep") || s.includes("slow_wave") || s.includes("slowwave")) return 2;
  if (s.includes("light") || s.includes("core") || s.includes("asleep") || s === "sleep") return 1;
  return null;
}

function segmentsFromFlexiblePhases(phases: unknown[]): SleepHypnogramSegment[] | null {
  if (!phases.length) return null;

  let minTs: number | null = null;
  let maxTs: number | null = null;
  const rangeBlocks: Array<{ stage: number; t0Ms: number; t1Ms: number }> = [];
  /** Blocchi ordinati `{ stage, durMin }` quando mancano gli ISO timestamp. */
  type Block = { stage: number; durMin: number };
  const durationBlocks: Block[] = [];

  for (const chunk of phases) {
    const o = asRecord(chunk);
    if (!o) continue;

    let stageRaw = coerceSleepStage(o.stage ?? o.type ?? o.code ?? o.state ?? o.sleep_stage ?? o.sleepStage ?? o.phase);
    if (stageRaw == null) {
      const label = typeof o.name === "string" ? coerceSleepStage(o.name) : null;
      if (label != null) stageRaw = label;
    }
    if (stageRaw == null) continue;

    const minExplicit = asNumber(o.minutes ?? o.duration_min ?? o.duration_minutes ?? o.m);
    const durFromSec =
      asNumber(o.duration_seconds) ??
      asNumber(o.duration_sec) ??
      asNumber((o as { durationSecs?: unknown }).durationSecs);
    let durMin: number | null =
      minExplicit != null && minExplicit > 0
        ? minExplicit
        : durFromSec != null && durFromSec > 0
          ? durFromSec / 60
          : null;

    const startIso = typeof o.start === "string" ? o.start : typeof o.start_time === "string" ? o.start_time : "";
    const endIso = typeof o.end === "string" ? o.end : typeof o.end_time === "string" ? o.end_time : "";
    let t0Ms: number | null = null;
    let t1Ms: number | null = null;
    if (startIso && endIso) {
      const a = Date.parse(startIso);
      const b = Date.parse(endIso);
      if (!Number.isNaN(a) && !Number.isNaN(b) && b > a) {
        if (durMin == null || durMin <= 0) durMin = (b - a) / 60_000;
        t0Ms = a;
        t1Ms = b;
      }
    }

    if (t0Ms != null && t1Ms != null) {
      rangeBlocks.push({ stage: stageRaw, t0Ms, t1Ms });
      minTs = minTs == null ? t0Ms : Math.min(minTs, t0Ms);
      maxTs = maxTs == null ? t1Ms : Math.max(maxTs, t1Ms);
      continue;
    }

    const durRounded = durMin != null && durMin > 0 ? durMin : null;
    if (durRounded != null) durationBlocks.push({ stage: stageRaw, durMin: durRounded });
  }

  if (minTs != null && maxTs != null && maxTs > minTs && rangeBlocks.length) {
    const span = maxTs - minTs;
    const segments: SleepHypnogramSegment[] = rangeBlocks
      .map((rb) => ({
        t0: (rb.t0Ms - minTs) / span,
        t1: (rb.t1Ms - minTs) / span,
        stage: rb.stage,
      }))
      .filter((s) => s.t1 > s.t0);
    return consolidateHypnogramSegments(segments);
  }

  const totalMin = durationBlocks.reduce((a, b) => a + b.durMin, 0);
  if (durationBlocks.length === 0 || totalMin <= 0) return null;
  let acc = 0;
  const segments: SleepHypnogramSegment[] = [];
  for (const b of durationBlocks) {
    segments.push({
      t0: acc / totalMin,
      t1: (acc + b.durMin) / totalMin,
      stage: b.stage,
    });
    acc += b.durMin;
  }
  return consolidateHypnogramSegments(segments);
}

function consolidateHypnogramSegments(segments: SleepHypnogramSegment[]): SleepHypnogramSegment[] {
  const sorted = [...segments].filter((s) => Number.isFinite(s.t0) && Number.isFinite(s.t1)).sort((a, b) => a.t0 - b.t0);
  const merged: SleepHypnogramSegment[] = [];
  for (const seg of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.stage === seg.stage && seg.t0 <= last.t1 + 1e-9) last.t1 = Math.max(last.t1, seg.t1);
    else merged.push({ ...seg, t0: segmentClamp01(seg.t0), t1: segmentClamp01(seg.t1) });
  }
  return merged;
}

function segmentClamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Ricostruzione temporale **approssimativa** da soli totali (es. WHOOP v2 pubblico senza serie segmenti).
 * Schema: sveglie ai bordi, deep verso primo terzo ciclo REM in zona centrale, leggero a riempire.
 */
function approximateHypnogramFromStageTotals(
  stages: SleepStageHours,
  sleepCycleCountHint: number | null,
): SleepHypnogramSegment[] | null {
  const awake = Math.max(0, stages.awakeHours ?? 0);
  const light = Math.max(0, stages.lightHours ?? 0);
  const deep = Math.max(0, stages.deepHours ?? 0);
  const rem = Math.max(0, stages.remHours ?? 0);
  const denom = awake + light + deep + rem;
  if (!(denom > 0)) return null;
  /** Ignoriamo cycle count nell’implementazione minimale ma lo teniamo per evoluzioni. */
  void sleepCycleCountHint;

  const blocks: Array<{ stage: number; hours: number }> = [];

  blocks.push({ stage: 0, hours: awake * 0.25 });
  blocks.push({ stage: 1, hours: light * 0.4 });
  blocks.push({ stage: 2, hours: deep });
  blocks.push({ stage: 1, hours: light * 0.35 });
  blocks.push({ stage: 3, hours: rem });
  blocks.push({ stage: 1, hours: light * 0.25 });
  blocks.push({ stage: 0, hours: awake * 0.75 });

  const totalHours = blocks.reduce((a, b) => a + b.hours, 0);
  if (!(totalHours > 1e-6)) return null;
  let acc = 0;
  const segments: SleepHypnogramSegment[] = blocks
    .filter((b) => b.hours > 1e-9)
    .map((b) => {
      const t0 = acc / totalHours;
      acc += b.hours;
      return {
        t0: segmentClamp01(t0),
        t1: segmentClamp01(acc / totalHours),
        stage: b.stage,
      };
    });
  return consolidateHypnogramSegments(segments);
}

function pickSleepWindowMs(payload: Record<string, unknown> | null): { startMs: number; endMs: number } | null {
  if (!payload) return null;
  const whoopSleep = asRecord(payload.whoop_sleep);
  const startWs = typeof whoopSleep?.start === "string" ? whoopSleep.start : "";
  const endWs = typeof whoopSleep?.end === "string" ? whoopSleep.end : "";
  if (startWs && endWs) {
    const a = Date.parse(startWs);
    const b = Date.parse(endWs);
    if (!Number.isNaN(a) && !Number.isNaN(b) && b > a + 600_000) return { startMs: a, endMs: b };
  }
  let startMs: number | null = null;
  let endMs: number | null = null;
  for (const rec of expandDevicePayloadMetricRecords(payload)) {
    for (const k of ["sleep_start_local", "start", "start_time"]) {
      const v = rec[k];
      if (typeof v === "string") {
        const t = Date.parse(v);
        if (!Number.isNaN(t)) startMs = startMs == null ? t : Math.min(startMs, t);
      }
    }
    for (const k of ["sleep_end_local", "end", "end_time"]) {
      const v = rec[k];
      if (typeof v === "string") {
        const t = Date.parse(v);
        if (!Number.isNaN(t)) endMs = endMs == null ? t : Math.max(endMs, t);
      }
    }
  }
  if (startMs != null && endMs != null && endMs > startMs + 600_000) return { startMs, endMs };
  return null;
}

function sleepCycleCount(stageSummary: Record<string, unknown>): number | null {
  const n = asNumber(stageSummary.sleep_cycle_count ?? stageSummary.sleepCycleCount);
  return n != null && Number.isFinite(n) && n > 0 ? Math.min(48, Math.trunc(n)) : null;
}

/**
 * Produce segmenti [0–1] lungo il sonno · prima serie fasi strutturate dal vendor, poi fallback da ore totali.
 */
export function extractSleepHypnogramFromDevicePayload(
  payload: Record<string, unknown> | null,
  stageTotals: SleepStageHours,
): HypnogramExtraction {
  const emptyApprox = (): HypnogramExtraction | null => {
    const cycleHint = inferSleepCycleHintFromPayload(payload);
    const approx =
      approximateHypnogramFromStageTotals(stageTotals, cycleHint ?? null);
    return approx?.length ? { kind: "approximated", segments: approx } : null;
  };

  if (!payload) return emptyApprox() ?? { kind: "approximated", segments: [] };

  const merged = expandDevicePayloadMetricRecords(payload);
  const phaseKeys = [
    "sleep_phase_minutes",
    "phases_minutes",
    "sleep_phases",
    "sleep_phase_timeline",
    "sleep_stages",
    "sleepStages",
    "stages",
    "timeline",
  ];

  for (const rec of merged) {
    for (const key of phaseKeys) {
      const raw = rec[key];
      if (Array.isArray(raw) && raw.length > 0) {
        const out = segmentsFromFlexiblePhases(raw);
        if (out?.length) return { kind: "phases", segments: out };
      }
    }
  }

  return emptyApprox() ?? { kind: "approximated", segments: [] };
}

function inferSleepCycleHintFromPayload(payload: Record<string, unknown> | null): number | null {
  if (!payload) return null;
  for (const rec of expandDevicePayloadMetricRecords(payload)) {
    const stage = asRecord(rec.stage_summary ?? rec.stageSummary);
    if (!stage) continue;
    const c = sleepCycleCount(stage);
    if (c != null) return c;
  }
  return null;
}

/** Legacy: punti stadio vs tempo ore (consumatori vecchi); preferisci segmenti tramite helper sotto */
export function tryBuildSleepHypnogramFromDevicePayload(
  payload: Record<string, unknown> | null,
): Array<{ t: number; stage: number }> {
  if (!payload) return [];
  const totals = extractSleepStagesFromDevicePayload(payload);
  const ex = extractSleepHypnogramFromDevicePayload(payload, totals);
  if (!ex.segments.length) return [];
  const pts: Array<{ t: number; stage: number }> = [];
  const center = ex.segments;
  let lastStage = center[0].stage;
  pts.push({ t: 0, stage: lastStage });
  for (const seg of center) {
    if (seg.stage !== lastStage) {
      pts.push({ t: seg.t0 * 24, stage: seg.stage });
      lastStage = seg.stage;
    }
    pts.push({ t: seg.t1 * 24, stage: seg.stage });
  }
  return pts;
}

export type SleepHypnogramWindow = {
  sleepStartUtc: string | null;
  sleepEndUtc: string | null;
};

/** Finestra cronologica leggibile dall’ISO WHOOOP `start` / `end`. */
export function extractSleepHypnogramWindowUtc(payload: Record<string, unknown> | null): SleepHypnogramWindow {
  const win = pickSleepWindowMs(payload);
  if (!win) return { sleepStartUtc: null, sleepEndUtc: null };
  return {
    sleepStartUtc: new Date(win.startMs).toISOString(),
    sleepEndUtc: new Date(win.endMs).toISOString(),
  };
}
