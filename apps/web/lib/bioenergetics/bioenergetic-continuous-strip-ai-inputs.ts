import type {
  BioenergeticMonitoringChannel24,
  BioenergeticMonitoringStreamPoint,
  BioenergeticsDayViewModel,
} from "@/api/bioenergetics/contracts";
import type { BioenergeticDayMemorySlice } from "@/lib/bioenergetics/bioenergetic-day-memory-slice";
import { num } from "@/lib/bioenergetics/bioenergetic-day-payload-parsers";

const N15 = 96;
const N288 = 288;

const STRIP_AI_DISCLAIMER_TAG =
  "Striscia monitoraggio continuo (24 h): OpenAI legge solo pasti (diario), sedute (pianificate/eseguite), conteggi stream e metadati serie — niente kernel/tile/hint del motore legacy sulla striscia.";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 96 valori (15 min) → 288 campioni (5 min), interpolazione lineare. */
export function interpolateFifteenMinuteSeriesToFiveMinuteStream(
  date: string,
  values96: readonly number[],
  clampLo: number,
  clampHi: number,
): BioenergeticMonitoringStreamPoint[] {
  if (values96.length !== N15) return [];
  const out: BioenergeticMonitoringStreamPoint[] = [];
  for (let i = 0; i < N288; i += 1) {
    const tMin = i * 5;
    const pos = tMin / 15;
    const i0 = Math.min(N15 - 1, Math.floor(pos));
    const i1 = Math.min(N15 - 1, i0 + 1);
    const frac = pos - i0;
    const v0 = values96[i0]!;
    const v1 = values96[i1]!;
    let v = v0 * (1 - frac) + v1 * frac;
    if (!Number.isFinite(v)) v = v0;
    v = clamp(v, clampLo, clampHi);
    const hh = Math.floor(tMin / 60) % 24;
    const mm = tMin % 60;
    const observedAt = `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
    out.push({ observedAt, value: Math.round(v * 1000) / 1000 });
  }
  return out;
}

export function expandHourly24ToFiveMinuteStream(
  date: string,
  hourly: readonly (number | null)[],
  clampLo: number,
  clampHi: number,
): BioenergeticMonitoringStreamPoint[] {
  if (hourly.length !== 24) return [];
  const out: BioenergeticMonitoringStreamPoint[] = [];
  for (let i = 0; i < N288; i += 1) {
    const tMin = i * 5;
    const hh = Math.floor(tMin / 60) % 24;
    const mm = tMin % 60;
    const raw = hourly[hh];
    const v = clamp(typeof raw === "number" && Number.isFinite(raw) ? raw : clampLo, clampLo, clampHi);
    const observedAt = `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
    out.push({ observedAt, value: Math.round(v * 1000) / 1000 });
  }
  return out;
}

function numArr(v: unknown, len: number): number[] | null {
  if (!Array.isArray(v) || v.length !== len) return null;
  const out: number[] = [];
  for (const x of v) {
    const n = typeof x === "number" ? x : Number(x);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

function numArrOrNull(v: unknown, len: number): number[] | null {
  if (v == null) return null;
  return numArr(v, len);
}

export type StripAiParseResult = {
  disclaimerIt: string;
  glucose96: number[] | null;
  lactate96: number[] | null;
  cortisol24: number[] | null;
  acth24: number[] | null;
  insulin24: number[] | null;
  noteIt: string | null;
};

function numField(row: Record<string, unknown>, key: string): number | null {
  return num(row[key]);
}

/**
 * Payload OpenAI per la striscia: **solo** realtà giornata (diario + training da memoria)
 * e metadati serie (provenance / conteggi), senza kernel, tile, hint interpretativi né timeline arricchita.
 */
export function buildOpenAiStripRealityCompact(
  vm: BioenergeticsDayViewModel,
  slice: BioenergeticDayMemorySlice,
  skipGlucosePredictor: boolean,
): Record<string, unknown> {
  const meals = slice.diaryRows.slice(0, 48).map((row) => ({
    entry_time: typeof row.entry_time === "string" ? row.entry_time : null,
    meal_slot: typeof row.meal_slot === "string" ? row.meal_slot : null,
    food_label: String(row.food_label ?? "").slice(0, 160),
    quantity_g: numField(row, "quantity_g"),
    carbs_g: numField(row, "carbs_g"),
    protein_g: numField(row, "protein_g"),
    fat_g: numField(row, "fat_g"),
    kcal: numField(row, "kcal"),
    sodium_mg: numField(row, "sodium_mg"),
    insulin_load: numField(row, "insulin_load"),
    glycemic_index_estimate: numField(row, "glycemic_index_estimate"),
    glycemic_load: numField(row, "glycemic_load"),
  }));

  const executed_workouts = slice.executed.slice(0, 32).map((w) => ({
    started_at: w.startedAt ?? null,
    ended_at: w.endedAt ?? null,
    duration_minutes: w.durationMinutes,
    tss: w.tss,
    kj: w.kj ?? null,
    kcal: w.kcal ?? null,
    source: w.source ?? null,
    lactate_mmol_from_device: w.lactateMmoll ?? null,
    glucose_mmol_from_device: w.glucoseMmol ?? null,
    subjective_notes_excerpt: w.subjectiveNotes ? String(w.subjectiveNotes).slice(0, 200) : null,
  }));

  const planned_workouts = slice.planned.slice(0, 32).map((p) => ({
    date: p.date,
    session_type: String(p.type ?? "").slice(0, 80),
    duration_minutes: p.durationMinutes,
    tss_target: p.tssTarget,
    kj_target: p.kjTarget ?? null,
    kcal_target: p.kcalTarget ?? null,
    adaptive_goal: p.adaptiveGoal ? String(p.adaptiveGoal).slice(0, 120) : null,
    notes_excerpt: p.notes ? String(p.notes).slice(0, 200) : null,
  }));

  const totalCarbs = slice.diaryRows.reduce((s, r) => s + (numField(r, "carbs_g") ?? 0), 0);
  const totalKcal = slice.diaryRows.reduce((s, r) => s + (numField(r, "kcal") ?? 0), 0);
  const executedTss = slice.executed.reduce((s, w) => s + Math.max(0, Number(w.tss ?? 0)), 0);
  const plannedTss = slice.planned.reduce((s, p) => s + Math.max(0, Number(p.tssTarget ?? 0)), 0);

  return {
    contract: "bioenergetic_strip_ai_reality_inputs_v2",
    date: vm.date,
    athlete_id: vm.athleteId,
    skip_glucose_predictor: skipGlucosePredictor,
    /** Nessun valore campionato della serie (né sim né misura) — solo contesto qualitativo. */
    glucose_series_meta: {
      provenance: vm.provenance.glucose,
      point_count: vm.channels.glucose?.length ?? 0,
    },
    lactate_series_meta: {
      provenance: vm.provenance.lactate,
      point_count: vm.channels.lactate?.length ?? 0,
    },
    canonical_stream_sample_counts: vm.canonicalStreamCounts,
    day_rollup: {
      diary_entry_count: slice.diaryRows.length,
      total_carbs_g_day: Math.round(totalCarbs * 10) / 10,
      total_kcal_day: Math.round(totalKcal),
      executed_session_count: slice.executed.length,
      planned_session_count: slice.planned.length,
      executed_tss_sum: Math.round(executedTss * 10) / 10,
      planned_tss_target_sum: Math.round(plannedTss * 10) / 10,
      biomarker_panel_rows_on_date: slice.biomarkerRows.length,
    },
    meals,
    executed_workouts,
    planned_workouts,
  };
}

export function parseStripAiOpenAiContent(raw: string): StripAiParseResult | null {
  const root = extractJsonObject(raw);
  if (!root) return null;
  const disclaimerIt =
    typeof root.disclaimer_it === "string"
      ? root.disclaimer_it.trim().slice(0, 800)
      : typeof root.disclaimerIt === "string"
        ? root.disclaimerIt.trim().slice(0, 800)
        : "";
  if (!disclaimerIt) return null;

  const glucose96 = numArrOrNull(root.glucose_mmol_15m ?? root.glucoseMmol15m, N15);
  const lactate96 = numArrOrNull(root.lactate_mmol_15m ?? root.lactateMmol15m, N15);
  const cortisol24 = numArrOrNull(root.cortisol_ug_dl_24 ?? root.cortisolUgdL24, 24);
  const acth24 = numArrOrNull(root.acth_pg_ml_24 ?? root.acthPgMl24, 24);
  const insulin24 = numArrOrNull(root.insulin_proxy_score_24 ?? root.insulinProxy024, 24);
  const noteIt =
    typeof root.note_it === "string"
      ? root.note_it.trim().slice(0, 500)
      : typeof root.noteIt === "string"
        ? root.noteIt.trim().slice(0, 500)
        : null;

  return { disclaimerIt, glucose96, lactate96, cortisol24, acth24, insulin24, noteIt };
}

function b24FromStream(st: BioenergeticMonitoringStreamPoint[]): (number | null)[] {
  const hourly: (number | null)[] = Array.from({ length: 24 }, () => null);
  const sum: number[] = Array.from({ length: 24 }, () => 0);
  const cnt: number[] = Array.from({ length: 24 }, () => 0);
  for (const p of st) {
    const m = p.observedAt.match(/T(\d{2}):/);
    if (!m) continue;
    const h = Number(m[1]);
    if (!Number.isFinite(h) || h < 0 || h > 23) continue;
    sum[h] += p.value;
    cnt[h] += 1;
  }
  for (let h = 0; h < 24; h += 1) {
    if (cnt[h]! > 0) hourly[h] = Math.round((sum[h]! / cnt[h]!) * 1000) / 1000;
  }
  return hourly;
}

export function buildMonitoringChannelsFromStripAiParse(
  vm: BioenergeticsDayViewModel,
  parsed: StripAiParseResult,
): BioenergeticMonitoringChannel24[] {
  const out: BioenergeticMonitoringChannel24[] = [];

  if (parsed.glucose96?.length === N15) {
    const st = interpolateFifteenMinuteSeriesToFiveMinuteStream(vm.date, parsed.glucose96, 3.2, 14);
    if (st.length) {
      out.push({
        id: "glucose",
        labelIt: "Glucosio",
        unit: "mmol/L",
        category: "metabolic",
        hourly: b24FromStream(st),
        streamTrace: st,
        dataPlane: "ai_from_inputs",
        replacesWithDeviceStream: true,
      });
    }
  }
  if (parsed.lactate96?.length === N15) {
    const st = interpolateFifteenMinuteSeriesToFiveMinuteStream(vm.date, parsed.lactate96, 0.5, 12);
    if (st.length) {
      out.push({
        id: "lactate",
        labelIt: "Lattato",
        unit: "mmol/L",
        category: "metabolic",
        hourly: b24FromStream(st),
        streamTrace: st,
        dataPlane: "ai_from_inputs",
        replacesWithDeviceStream: true,
      });
    }
  }
  if (parsed.insulin24?.length === 24) {
    const h = parsed.insulin24.map((x) => clamp(x, 0, 100)) as (number | null)[];
    const st = expandHourly24ToFiveMinuteStream(vm.date, h, 0, 100);
    out.push({
      id: "insulin_proxy",
      labelIt: "Domanda insulinica (proxy)",
      unit: "score 0–100",
      category: "metabolic",
      hourly: h,
      streamTrace: st,
      dataPlane: "ai_from_inputs",
      replacesWithDeviceStream: true,
    });
  }
  if (parsed.cortisol24?.length === 24) {
    const h = parsed.cortisol24.map((x) => clamp(x, 2, 28)) as (number | null)[];
    const st = expandHourly24ToFiveMinuteStream(vm.date, h, 2, 28);
    out.push({
      id: "cortisol",
      labelIt: "Cortisolo",
      unit: "µg/dL",
      category: "hormonal",
      hourly: h,
      streamTrace: st,
      dataPlane: "ai_from_inputs",
      replacesWithDeviceStream: true,
    });
  }
  if (parsed.acth24?.length === 24) {
    const h = parsed.acth24.map((x) => clamp(x, 5, 60)) as (number | null)[];
    const st = expandHourly24ToFiveMinuteStream(vm.date, h, 5, 60);
    out.push({
      id: "acth",
      labelIt: "ACTH",
      unit: "pg/mL",
      category: "hormonal",
      hourly: h,
      streamTrace: st,
      dataPlane: "ai_from_inputs",
      replacesWithDeviceStream: true,
    });
  }

  return out;
}

export async function requestOpenAiBioenergeticStripFromInputs(
  compact: Record<string, unknown>,
  opts: { apiKey: string; model: string },
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const skipGlu = Boolean(compact.skip_glucose_predictor);
  const system = [
    "Sei il generatore curve EMPATHY Pro 2 — BioEnergetic Intelligence.",
    "Ricevi il JSON `bioenergetic_strip_ai_reality_inputs_v2`: pasti da diario (`meals`), sedute eseguite/pianificate (`executed_workouts`, `planned_workouts`), totali giorno (`day_rollup`), conteggi campioni stream (`canonical_stream_sample_counts`), metadati serie glucosio/lattato senza valori (`glucose_series_meta`, `lactate_series_meta`).",
    "Non ricevi kernel metabolico, tile lab/sim, hint interpretativi né timeline arricchita: ignora ogni conoscenza di «motore» Empathy eliminato; le curve devono seguire solo quei campi.",
    "Non ricevi serie numeriche pre-calcolate per la striscia: proponi tu andamenti plausibili coerenti con pasti, CHO/kcal, orari, TSS/durate sedute e note soggettive se presenti.",
    "Risposta: SOLO JSON valido (nessun testo fuori dal JSON).",
    skipGlu
      ? "NON includere glucose_mmol_15m (glucosio già da misura densa quel giorno — molti punti nella serie)."
      : "Includi glucose_mmol_15m: esattamente 96 numeri (mmol/L), uno ogni 15 min da 00:00 a 23:45 della `date`.",
    "Includi lactate_mmol_15m: 96 numeri (mmol/L) coerenti con sedute e pasti.",
    "Includi cortisol_ug_dl_24 e acth_pg_ml_24: 24 numeri (ore 0–23).",
    "Includi insulin_proxy_score_24: 24 numeri 0–100 (domanda insulinica qualitativa).",
    "disclaimer_it obbligatorio in italiano: curve illustrative da input, non diagnosi, non sostituiscono laboratorio o CGM.",
    "Opzionale: note_it.",
  ].join(" ");

  const user = `Genera le serie per questa giornata (solo da input realtà v2 — pasti e training, niente kernel/tile):\n\n${JSON.stringify(compact)}`;

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: 0.35,
        max_tokens: 9000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }

  if (!response.ok) {
    const t = await response.text().catch(() => "");
    return { ok: false, error: `OpenAI HTTP ${response.status}: ${t.slice(0, 200)}` };
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: "empty_response" };
  return { ok: true, text };
}

function shouldSkipGlucosePredictor(vm: BioenergeticsDayViewModel): boolean {
  const n = vm.channels.glucose?.length ?? 0;
  return vm.provenance.glucose === "measured" && n >= 48;
}

/**
 * Sostituisce la striscia «monitoraggio continuo» con canali costruiti **solo** da OpenAI
 * sul compact degli input (`omitMonitoringStrip` lascia la striscia vuota in presentation).
 */
export async function fillContinuousMonitoringStripFromOpenAiInputs(
  vm: BioenergeticsDayViewModel,
  slice: BioenergeticDayMemorySlice,
): Promise<BioenergeticsDayViewModel> {
  const disclaimersBase = vm.disclaimers.includes(STRIP_AI_DISCLAIMER_TAG)
    ? vm.disclaimers
    : [...vm.disclaimers, STRIP_AI_DISCLAIMER_TAG];

  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    return {
      ...vm,
      disclaimers: [
        ...disclaimersBase,
        "Imposta OPENAI_API_KEY sul server per generare le curve della striscia dagli input (nessun fallback deterministico sulla striscia).",
      ],
      continuousMonitoring: { layer: "ai_from_inputs_v1", channels: [] },
    };
  }

  const skipGlucose = shouldSkipGlucosePredictor(vm);
  const compact = buildOpenAiStripRealityCompact(vm, slice, skipGlucose);
  const model = (process.env.OPENAI_BIOENERGETIC_MODEL ?? "").trim() || "gpt-4o-mini";
  const ai = await requestOpenAiBioenergeticStripFromInputs(compact, { apiKey, model });
  if (!ai.ok) {
    return {
      ...vm,
      disclaimers: [...disclaimersBase, `OpenAI striscia: ${ai.error}`],
      continuousMonitoring: { layer: "ai_from_inputs_v1", channels: [] },
    };
  }

  const parsed = parseStripAiOpenAiContent(ai.text);
  if (!parsed) {
    return {
      ...vm,
      disclaimers: [...disclaimersBase, "OpenAI striscia: JSON non interpretabile."],
      continuousMonitoring: { layer: "ai_from_inputs_v1", channels: [] },
    };
  }

  const channels = buildMonitoringChannelsFromStripAiParse(vm, parsed);
  if (!channels.length) {
    return {
      ...vm,
      disclaimers: [...disclaimersBase, "OpenAI striscia: nessun canale costruito (controlla la risposta)."],
      continuousMonitoring: { layer: "ai_from_inputs_v1", channels: [] },
    };
  }

  const noteLine = parsed.noteIt ? ` OpenAI nota: ${parsed.noteIt}` : "";
  const discLine = parsed.disclaimerIt && parsed.disclaimerIt !== "—" ? ` ${parsed.disclaimerIt}` : "";
  return {
    ...vm,
    disclaimers: [...disclaimersBase, `Modello striscia:${discLine}${noteLine}`.trim()],
    continuousMonitoring: { layer: "ai_from_inputs_v1", channels },
  };
}
