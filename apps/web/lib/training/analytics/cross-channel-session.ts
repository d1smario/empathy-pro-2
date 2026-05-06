/**
 * Cross-channel intra-sessione: data una sessione eseguita e i record CGM (`device_sync_exports`
 * provider `cgm`), produce serie temporali allineate (asse `t [s]`) per overlay
 * Analyzer (Fase 4 device→UI).
 *
 * Pure & deterministic: nessuna fetch — la route `/api/training/analytics` raccoglie
 * gli input e chiama questo helper, l’UI si limita a consumare il VM.
 */

function asNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickSeries(trace: Record<string, unknown> | null, keys: string[]): number[] {
  if (!trace) return [];
  for (const k of keys) {
    const raw = trace[k];
    if (!Array.isArray(raw)) continue;
    const out: number[] = [];
    for (const v of raw) {
      const n = asNum(v);
      if (n != null) out.push(n);
    }
    if (out.length > 1) return out;
  }
  return [];
}

function pickNumber(trace: Record<string, unknown> | null, keys: string[]): number | null {
  if (!trace) return null;
  for (const k of keys) {
    const v = asNum(trace[k]);
    if (v != null) return v;
  }
  return null;
}

export type CrossChannelExecutedRow = {
  id: string;
  date: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number | null;
  traceSummary: Record<string, unknown> | null;
};

export type CrossChannelCgmRow = {
  payload: Record<string, unknown>;
  createdAt: string | null;
};

export type CrossChannelSessionVm = {
  executedId: string;
  date: string | null;
  durationSeconds: number;
  /** Power series in W (anche se `executed` non ha `power_series_w`, fallback HR per allineamento UI) */
  powerSeries: number[];
  hrSeries: number[];
  /** Glucose campionato dentro `[startedAt, endedAt]`, in mmol/L. */
  glucosePoints: Array<{ tSec: number; mmol: number }>;
  hasPower: boolean;
  hasHr: boolean;
  hasGlucose: boolean;
};

function parseIsoTimeMillis(input: string | null | undefined): number | null {
  if (!input) return null;
  const ms = new Date(input).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function extractCgmPointsFromPayload(
  payload: Record<string, unknown>,
): Array<{ ts: number; mmol: number }> {
  const out: Array<{ ts: number; mmol: number }> = [];
  // Forme comuni: payload.samples = [{ ts | timestamp, mmol_l | glucose_mmol_l | mg_dl }]
  // Oppure payload.sourcePayload.points o payload.realityIngestion.canonicalPreview.points
  const candidates: Array<unknown> = [
    payload.samples,
    payload.points,
    asRecord(payload.sourcePayload)?.samples,
    asRecord(payload.sourcePayload)?.points,
    asRecord(asRecord(payload.realityIngestion)?.canonicalPreview)?.samples,
    asRecord(asRecord(payload.realityIngestion)?.canonicalPreview)?.points,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const item of candidate) {
      const rec = asRecord(item);
      if (!rec) continue;
      const tsRaw = rec.ts ?? rec.timestamp ?? rec.recorded_at ?? rec.time;
      const ts =
        typeof tsRaw === "number" ? (tsRaw > 1e12 ? tsRaw : tsRaw * 1000) : parseIsoTimeMillis(typeof tsRaw === "string" ? tsRaw : null);
      if (ts == null) continue;
      const mmol =
        asNum(rec.mmol_l ?? rec.glucose_mmol_l ?? rec.glucose_mmol ?? rec.value_mmol_l) ??
        (() => {
          const mg = asNum(rec.mg_dl ?? rec.glucose_mg_dl ?? rec.value_mg_dl);
          return mg != null ? mg / 18 : null;
        })();
      if (mmol == null) continue;
      out.push({ ts, mmol });
    }
    if (out.length) return out;
  }
  return out;
}

export function buildCrossChannelForSession(
  exec: CrossChannelExecutedRow,
  cgmRows: CrossChannelCgmRow[],
): CrossChannelSessionVm | null {
  const trace = asRecord(exec.traceSummary);
  const power = pickSeries(trace, ["power_series_w"]);
  const hr = pickSeries(trace, ["hr_series_bpm"]);
  if (power.length < 2 && hr.length < 2) return null;

  const startMs =
    parseIsoTimeMillis(exec.startedAt) ??
    (exec.date ? parseIsoTimeMillis(`${exec.date}T08:00:00`) : null);
  if (startMs == null) return null;
  const durationSec =
    pickNumber(trace, ["duration_seconds", "duration_s"]) ??
    (exec.durationMinutes != null && Number.isFinite(exec.durationMinutes)
      ? Math.round(exec.durationMinutes * 60)
      : 0);
  if (durationSec <= 0) return null;
  const endMs = parseIsoTimeMillis(exec.endedAt) ?? startMs + durationSec * 1000;

  const glucosePoints: Array<{ tSec: number; mmol: number }> = [];
  for (const row of cgmRows) {
    const points = extractCgmPointsFromPayload(row.payload);
    for (const p of points) {
      if (p.ts < startMs || p.ts > endMs) continue;
      const tSec = Math.round((p.ts - startMs) / 1000);
      glucosePoints.push({ tSec, mmol: p.mmol });
    }
  }
  glucosePoints.sort((a, b) => a.tSec - b.tSec);

  return {
    executedId: exec.id,
    date: exec.date,
    durationSeconds: durationSec,
    powerSeries: power,
    hrSeries: hr,
    glucosePoints,
    hasPower: power.length > 1,
    hasHr: hr.length > 1,
    hasGlucose: glucosePoints.length > 0,
  };
}

export type CrossChannelInputs = {
  executed: CrossChannelExecutedRow[];
  cgmExports: CrossChannelCgmRow[];
  /** Massimo numero di sessioni produrre (default 4): le più recenti con power_series. */
  maxSessions?: number;
};

export function buildCrossChannelSessionVms(input: CrossChannelInputs): CrossChannelSessionVm[] {
  const max = Math.max(1, input.maxSessions ?? 4);
  const sorted = [...input.executed].sort((a, b) => {
    const da = a.startedAt ?? a.date ?? "";
    const db = b.startedAt ?? b.date ?? "";
    return da > db ? -1 : 1;
  });
  const out: CrossChannelSessionVm[] = [];
  for (const exec of sorted) {
    const vm = buildCrossChannelForSession(exec, input.cgmExports);
    if (!vm) continue;
    if (!vm.hasPower && !vm.hasHr) continue;
    out.push(vm);
    if (out.length >= max) break;
  }
  return out;
}
