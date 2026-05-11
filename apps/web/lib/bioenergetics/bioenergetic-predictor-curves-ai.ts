import type {
  BioenergeticMonitoringChannel24,
  BioenergeticMonitoringStreamPoint,
  BioenergeticsDayViewModel,
} from "@/api/bioenergetics/contracts";

const N15 = 96;
const N288 = 288;

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

/** 96 valori (uno ogni 15 min) → 288 campioni (5 min), interpolazione lineare. */
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

/** 24 valori orari costanti per slot da 5 min (12 punti/ora). */
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

export function compactBioenergeticDayForPredictorAi(
  vm: BioenergeticsDayViewModel,
  opts: { skipGlucosePredictor: boolean },
): Record<string, unknown> {
  const timeline = [...vm.timeline]
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .slice(0, 100)
    .map((e) => ({
      ts: e.ts,
      type: e.type,
      title: e.title.slice(0, 180),
      payload: e.payload ?? undefined,
    }));

  return {
    contract: "bioenergetic_predictor_curves_v1",
    date: vm.date,
    athleteId: vm.athleteId,
    skip_glucose_predictor: opts.skipGlucosePredictor,
    provenance: vm.provenance,
    kernel: vm.kernel,
    timeline,
    interpretationHints: vm.interpretationHints?.slice(0, 20) ?? [],
    metricTiles: vm.metricTiles?.slice(0, 24).map((t) => ({
      id: t.id,
      labelIt: t.labelIt,
      displayValue: t.displayValue,
      numericValue: t.numericValue,
      provenance: t.provenance,
    })),
  };
}

export type PredictorCurvesParseResult = {
  disclaimerIt: string;
  glucose96: number[] | null;
  lactate96: number[] | null;
  cortisol24: number[] | null;
  acth24: number[] | null;
  insulin24: number[] | null;
  noteIt: string | null;
};

/**
 * Serie sintetiche per QA UI quando manca OpenAI (solo se `EMPATHY_PREDICTOR_DEMO=1` sulla route).
 * Stesso merge di `buildPredictorChannelsFromParse` del flusso AI; numeri fissi, **non** inferenza LLM.
 */
export function buildPredictorCurvesDemoParseResult(skipGlucosePredictor: boolean): PredictorCurvesParseResult {
  const disclaimerIt =
    "Curva dimostrativa generata in locale (nessuna chiamata OpenAI). Solo per vedere le strisce nell’interfaccia: non è valore clinico né output del modello LLM.";
  const glucose96 = skipGlucosePredictor
    ? null
    : Array.from({ length: 96 }, (_, i) => {
        const hours = (i * 15) / 60;
        const night = hours < 5 || hours > 22 ? 0.12 : 0;
        const dawn = Math.exp(-Math.pow((hours - 6) / 1.85, 2)) * 1.05;
        const meal1 = Math.exp(-Math.pow((hours - 8) / 0.52, 2)) * 1.28;
        const meal2 = Math.exp(-Math.pow((hours - 13) / 0.48, 2)) * 0.92;
        const endurance = hours >= 17 && hours <= 18.75 ? 0.38 : 0;
        return clamp(4.35 + dawn + meal1 + meal2 - night * 0.35 - endurance, 3.8, 11.5);
      });
  const lactate96 = Array.from({ length: 96 }, (_, i) => {
    const hours = (i * 15) / 60;
    const base = 1.08 + Math.sin(((hours - 14) * Math.PI) / 10) * 0.22;
    const ex = hours >= 17 && hours <= 18.75 ? 1.35 : 0;
    return clamp(base + ex, 0.7, 6.5);
  });
  const cortisol24 = Array.from({ length: 24 }, (_, h) =>
    clamp(8 + 14 * Math.exp(-Math.pow((h - 7.5) / 2.15, 2)), 2, 26),
  );
  const acth24 = Array.from({ length: 24 }, (_, h) =>
    clamp(18 + 22 * Math.exp(-Math.pow((h - 6.9) / 1.95, 2)), 5, 55),
  );
  const insulin24 = Array.from({ length: 24 }, (_, h) => {
    const v =
      24 +
      46 * Math.exp(-Math.pow((h - 8) / 1.05, 2)) +
      38 * Math.exp(-Math.pow((h - 13) / 0.95, 2));
    return clamp(v, 0, 100);
  });
  return {
    disclaimerIt,
    glucose96,
    lactate96,
    cortisol24,
    acth24,
    insulin24,
    noteIt:
      "Modalità demo: stessa pipeline di interpolazione del predittore AI, dati sintetici fissi (non inferenza).",
  };
}

export function parsePredictorCurvesOpenAiContent(raw: string): PredictorCurvesParseResult | null {
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

export function buildPredictorChannelsFromParse(
  vm: BioenergeticsDayViewModel,
  parsed: PredictorCurvesParseResult,
): BioenergeticMonitoringChannel24[] {
  const base = vm.continuousMonitoring?.channels ?? [];
  const out: BioenergeticMonitoringChannel24[] = [];

  const patch = (id: string, next: Partial<BioenergeticMonitoringChannel24>) => {
    const b = base.find((c) => c.id === id);
    if (!b) return;
    out.push({
      ...b,
      ...next,
      id: b.id,
      labelIt: b.labelIt,
      unit: b.unit,
      category: b.category,
      replacesWithDeviceStream: b.replacesWithDeviceStream,
      dataPlane: "model_predictor_ai",
      curveResolution: undefined,
    });
  };

  if (parsed.glucose96) {
    const st = interpolateFifteenMinuteSeriesToFiveMinuteStream(vm.date, parsed.glucose96, 3.8, 11.5);
    if (st.length) patch("glucose", { streamTrace: st, hourly: b24FromStream(st) });
  }
  if (parsed.lactate96) {
    const st = interpolateFifteenMinuteSeriesToFiveMinuteStream(vm.date, parsed.lactate96, 0.7, 6.5);
    if (st.length) patch("lactate", { streamTrace: st, hourly: b24FromStream(st) });
  }
  if (parsed.cortisol24) {
    const h = parsed.cortisol24.map((x) => clamp(x, 2, 26)) as (number | null)[];
    const st = expandHourly24ToFiveMinuteStream(vm.date, h, 2, 26);
    patch("cortisol", { hourly: h, streamTrace: st });
  }
  if (parsed.acth24) {
    const h = parsed.acth24.map((x) => clamp(x, 5, 55)) as (number | null)[];
    const st = expandHourly24ToFiveMinuteStream(vm.date, h, 5, 55);
    patch("acth", { hourly: h, streamTrace: st });
  }
  if (parsed.insulin24) {
    const h = parsed.insulin24.map((x) => clamp(x, 0, 100)) as (number | null)[];
    const st = expandHourly24ToFiveMinuteStream(vm.date, h, 0, 100);
    patch("insulin_proxy", { hourly: h, streamTrace: st });
  }

  return out;
}

const STRIP_OPENAI_DISCLAIMER_IT =
  "Striscia monitoraggio continuo: curve generate da OpenAI sui dati giornata assemblati (predittore integrato nell'assembler), salvo glucosio da stream CGM denso (predittore omesso su quel canale) o profili lab a valore unico tenuto costante.";

/**
 * Dopo la VM deterministica completa, sostituisce le strisce `model_predictor_ai` sui canali restituiti dal parse
 * (stessa logica del POST `/api/bioenergetics/predictor-curves`). In assenza di chiave o su errore OpenAI → `vm` invariato.
 * `EMPATHY_BIOENERGETIC_STRIP_AI=0` forza il no-op (solo motore deterministico).
 */
export async function applyOpenAiContinuousMonitoringStrip(
  vm: BioenergeticsDayViewModel,
  opts?: { apiKey?: string; model?: string },
): Promise<BioenergeticsDayViewModel> {
  const apiKey = (opts?.apiKey ?? process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) return vm;
  if (process.env.EMPATHY_BIOENERGETIC_STRIP_AI === "0") return vm;
  if (!vm.continuousMonitoring?.channels?.length) return vm;

  const gluCh = vm.continuousMonitoring.channels.find((c) => c.id === "glucose");
  const skipGlucosePredictor =
    vm.provenance.glucose === "measured" &&
    (gluCh?.dataPlane === "measured_stream" || (gluCh?.streamTrace?.length ?? 0) >= 48);

  const model = (opts?.model ?? process.env.OPENAI_BIOENERGETIC_MODEL ?? "").trim() || "gpt-4o-mini";
  const compact = compactBioenergeticDayForPredictorAi(vm, { skipGlucosePredictor });
  const ai = await requestOpenAiPredictorCurves(compact, { apiKey, model });
  if (!ai.ok) return vm;

  const parsed = parsePredictorCurvesOpenAiContent(ai.text);
  if (!parsed) return vm;

  const channels = buildPredictorChannelsFromParse(vm, parsed);
  if (!channels.length) return vm;

  const pmap = new Map(channels.map((c) => [c.id, c]));
  const nextChannels = vm.continuousMonitoring.channels.map((ch) => {
    const p = pmap.get(ch.id);
    return p ? { ...ch, ...p } : ch;
  });

  const disclaimers = vm.disclaimers.includes(STRIP_OPENAI_DISCLAIMER_IT)
    ? vm.disclaimers
    : [...vm.disclaimers, STRIP_OPENAI_DISCLAIMER_IT];

  return {
    ...vm,
    disclaimers,
    continuousMonitoring: {
      ...vm.continuousMonitoring,
      channels: nextChannels,
    },
  };
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

export async function requestOpenAiPredictorCurves(
  compact: Record<string, unknown>,
  opts: { apiKey: string; model: string },
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const skipGlu = Boolean(compact.skip_glucose_predictor);
  const system = [
    "Sei un predittore educativo EMPATHY Pro 2 (BioEnergetic Intelligence).",
    "Ricevi JSON con timeline (pasti, sedute, lab…), kernel, tile e provenance.",
    "Devi restituire SOLO JSON (nessun testo fuori dal JSON) con andamenti qualitativi plausibili — non valori clinici certi.",
    skipGlu
      ? "NON includere la chiave glucose_mmol_15m (glucosio già da misura CGM/stream quel giorno)."
      : "Includi glucose_mmol_15m: esattamente 96 numeri (mmol/L), uno ogni 15 minuti da 00:00 a 23:45 del campo date.",
    "Includi lactate_mmol_15m: esattamente 96 numeri (mmol/L) coerenti con sedute (lattato in salita sotto sforzo) e pasti.",
    "Includi cortisol_ug_dl_24 e acth_pg_ml_24: 24 numeri ciascuno (uno per ora 0–23), forma circadiana plausibile.",
    "Includi insulin_proxy_score_24: 24 numeri 0–100 (domanda insulinica qualitativa), picchi dopo pasti CHO.",
    "Notte sonno: glucosio e lattato relativamente stabili (niente rampa artificiale tutta la notte). Pasti: salita post-prandiale con ritardo ~25–50 minuti. Allenamento: glucosio in calo durante la finestra seduta se endurance.",
    "disclaimer_it obbligatorio (italiano): chiarisci che è predizione illustrativa, non diagnosi e non sostituisce misure.",
    "Opzionale: note_it.",
  ].join(" ");

  const user = `Genera le serie per questa giornata:\n\n${JSON.stringify(compact)}`;

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
