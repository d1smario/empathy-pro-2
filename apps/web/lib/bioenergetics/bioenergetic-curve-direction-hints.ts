import type {
  BioenergeticCurveDirectionHintsResponseV1,
  BioenergeticCurveDirectionSegmentV1,
  BioenergeticCurveDirectionTrendV1,
  BioenergeticsDayViewModel,
} from "@/api/bioenergetics/contracts";

const ALLOWED_CHANNELS = new Set<BioenergeticCurveDirectionSegmentV1["channel"]>([
  "glucose",
  "lactate",
  "insulin_proxy",
  "cortisol",
  "acth",
]);

const MAX_SEGMENTS = 32;
const MAX_TIMELINE_EVENTS = 96;

function downsampleStream<T>(arr: T[], step: number): T[] {
  if (step < 1 || !arr.length) return arr;
  return arr.filter((_, i) => i % step === 0);
}

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function trendFromUnknown(v: unknown): BioenergeticCurveDirectionTrendV1 {
  const t = str(v, 20).toLowerCase();
  if (t === "rise" || t === "up" || t === "salita" || t === "aumento") return "rise";
  if (t === "fall" || t === "down" || t === "discesa" || t === "calo") return "fall";
  return "plateau";
}

function parseSegment(o: Record<string, unknown>): BioenergeticCurveDirectionSegmentV1 | null {
  const channelRaw = str(o.channel ?? o.channel_id, 32);
  if (!ALLOWED_CHANNELS.has(channelRaw as BioenergeticCurveDirectionSegmentV1["channel"])) return null;
  const channel = channelRaw as BioenergeticCurveDirectionSegmentV1["channel"];
  const startObservedAt = str(o.start_observed_at ?? o.startObservedAt, 40);
  const endObservedAt = str(o.end_observed_at ?? o.endObservedAt, 40);
  if (!startObservedAt || !endObservedAt) return null;
  const t0 = Date.parse(startObservedAt);
  const t1 = Date.parse(endObservedAt);
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return null;
  if (t1 - t0 > 14 * 60 * 60 * 1000) return null;
  const rationaleIt = str(o.rationale_it ?? o.rationaleIt, 280) || "—";
  const driversRaw = o.drivers;
  const drivers: string[] = Array.isArray(driversRaw)
    ? driversRaw
        .map((x) => (typeof x === "string" ? x.trim().slice(0, 120) : ""))
        .filter(Boolean)
        .slice(0, 8)
    : [];
  return {
    channel,
    startObservedAt,
    endObservedAt,
    trend: trendFromUnknown(o.trend),
    rationaleIt,
    drivers,
  };
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

export function parseCurveDirectionHintsOpenAiContent(
  raw: string,
  ctx: { athleteId: string; date: string },
): Omit<BioenergeticCurveDirectionHintsResponseV1, "skippedReason"> | null {
  const root = extractJsonObject(raw);
  if (!root) return null;
  const summaryIt = str(root.summary_it ?? root.summaryIt, 520) || null;
  const segsRaw = root.segments;
  if (!Array.isArray(segsRaw)) return null;
  const segments: BioenergeticCurveDirectionSegmentV1[] = [];
  for (const item of segsRaw) {
    if (typeof item !== "object" || item == null) continue;
    const s = parseSegment(item as Record<string, unknown>);
    if (s) segments.push(s);
    if (segments.length >= MAX_SEGMENTS) break;
  }
  segments.sort((a, b) => a.startObservedAt.localeCompare(b.startObservedAt));
  return {
    hintsContractVersion: 1,
    athleteId: ctx.athleteId,
    date: ctx.date,
    summaryIt: summaryIt ?? "—",
    segments,
    noteIt: str(root.note_it ?? root.noteIt, 400) || null,
  };
}

/** Payload compatto per l'LLM: stessi dati che alimentano il motore (timeline, kernel, trace 5 min sottocampionata). */
export function compactBioenergeticDayForDirectionHints(vm: BioenergeticsDayViewModel): Record<string, unknown> {
  const timeline = [...vm.timeline]
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .slice(0, MAX_TIMELINE_EVENTS)
    .map((e) => ({
      ts: e.ts,
      type: e.type,
      title: e.title.slice(0, 160),
      payload: e.payload ?? undefined,
    }));

  const cm = vm.continuousMonitoring;
  const streamById: Record<string, { observedAt: string; value: number }[]> = {};
  if (cm?.channels?.length) {
    for (const ch of cm.channels) {
      if (!ch.streamTrace?.length) continue;
      streamById[ch.id] = downsampleStream(ch.streamTrace, 3).map((p) => ({
        observedAt: p.observedAt,
        value: p.value,
      }));
    }
  }

  return {
    contract: "bioenergetic_curve_direction_hints_v1",
    date: vm.date,
    athleteId: vm.athleteId,
    kernel: vm.kernel,
    timeline,
    interpretationHints: vm.interpretationHints?.slice(0, 24) ?? [],
    metricTiles: vm.metricTiles?.slice(0, 28).map((t) => ({
      id: t.id,
      labelIt: t.labelIt,
      unit: t.unit,
      displayValue: t.displayValue,
      numericValue: t.numericValue,
      provenance: t.provenance,
      category: t.category,
    })),
    chart24hGlucoseLactate: (vm.chart24h ?? []).map((h) => ({
      hour: h.hour,
      glucoseMmol: h.glucoseMmol,
      lactateMmol: h.lactateMmol,
    })),
    streams5mDownsampled: streamById,
    disclaimers: vm.disclaimers?.slice(0, 8) ?? [],
    provenance: vm.provenance,
    canonicalStreamCounts: vm.canonicalStreamCounts,
    interactionNorthStarIt:
      typeof vm.interactionSkeleton?.northStarIt === "string"
        ? vm.interactionSkeleton.northStarIt.trim().slice(0, 600)
        : null,
  };
}

export async function requestOpenAiCurveDirectionHints(
  compact: Record<string, unknown>,
  opts: { apiKey: string; model: string; athleteId: string; date: string },
): Promise<BioenergeticCurveDirectionHintsResponseV1> {
  const system = [
    "Sei il modulo di interpretazione EMPATHY Pro 2 per BioEnergetic Intelligence.",
    "Ricevi un JSON con timeline giornaliera (pasti, sedute, device, lab), kernel metabolico, tile, e serie deterministiche a passo 5 minuti (sottocampionate).",
    "NON devi inventare valori numerici di concentrazione (niente mmol/L).",
    "NON sostituire il motore deterministico: produci solo analisi qualitativa di direzione della curva per intervalli temporali.",
    `Rispondi SOLO con un oggetto JSON con chiavi: summary_it (stringa italiana, max ~400 caratteri), segments (array, max ${MAX_SEGMENTS} elementi).`,
    "Ogni elemento di segments deve avere: channel (una tra glucose, lactate, insulin_proxy, cortisol, acth), start_observed_at, end_observed_at (ISO 8601 come negli esempi di streams5mDownsampled, stesso giorno della richiesta), trend (rise | fall | plateau), rationale_it (italiano, breve), drivers (array di stringhe brevi: fattori da timeline/kernel, es. pasto CHO, seduta aerobica, digiuno, sonno).",
    "Allinea gli intervalli a fenomeni plausibili legati ai dati ricevuti (pasti, allenamenti, sonno). Se un dato manca, dichiaralo nel rationale invece di inventare orari.",
    "Opzionale: note_it per avvisi (es. timeline vuota).",
  ].join(" ");

  const user = `Analizza questo giornata e indica dove, per ogni canale rilevante, ti aspetti salita (rise), discesa (fall) o plateau della curva fisiologica modellata, coerente con i fattori influenzanti presenti nel JSON.\n\n${JSON.stringify(compact)}`;

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
        temperature: 0.2,
        max_tokens: 3500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
  } catch (e) {
    return {
      hintsContractVersion: 1,
      athleteId: opts.athleteId,
      date: opts.date,
      summaryIt: "—",
      segments: [],
      noteIt: e instanceof Error ? e.message : "network",
      skippedReason: "network",
    };
  }

  if (!response.ok) {
    const t = await response.text().catch(() => "");
    return {
      hintsContractVersion: 1,
      athleteId: opts.athleteId,
      date: opts.date,
      summaryIt: "—",
      segments: [],
      noteIt: `OpenAI HTTP ${response.status}: ${t.slice(0, 200)}`,
      skippedReason: "bad_openai_response",
    };
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return {
      hintsContractVersion: 1,
      athleteId: opts.athleteId,
      date: opts.date,
      summaryIt: "—",
      segments: [],
      noteIt: "Risposta vuota dal modello.",
      skippedReason: "bad_openai_response",
    };
  }

  const parsed = parseCurveDirectionHintsOpenAiContent(text, { athleteId: opts.athleteId, date: opts.date });
  if (!parsed) {
    return {
      hintsContractVersion: 1,
      athleteId: opts.athleteId,
      date: opts.date,
      summaryIt: "—",
      segments: [],
      noteIt: "JSON del modello non interpretabile.",
      skippedReason: "bad_openai_response",
    };
  }

  return { ...parsed, skippedReason: undefined };
}
