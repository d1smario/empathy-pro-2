import type {
  BioenergeticChannelProvenance,
  BioenergeticContinuousMonitoringDay,
  BioenergeticDayKernelOutput,
  BioenergeticMonitoringChannel24,
  BioenergeticMonitoringDataPlane,
  BioenergeticMonitoringStreamPoint,
  BioenergeticPathwayImpact,
  BioenergeticSeriesPoint,
  BioenergeticTimelineEvent,
  BioenergeticMetricTile,
  BioenergeticHour24Point,
} from "@/api/bioenergetics/contracts";
import {
  activitySupportHours,
  arbitrateGlucoseCurveFusionV1,
  arbitrateInsulinProxyCurveFusionV1,
  arbitrateLabHoldHormoneCurveFusionV1,
  arbitrateLactateCurveFusionV1,
  arbitrateNominalHormoneCurveFusionV1,
  buildInsulinProxyHourly24,
  buildNominalCortisolActhHourly24,
  buildNominalGhGhrelinHourly24,
  buildNominalIgf1LeptinHourly24,
  buildNominalThyroidTshFt4Hourly24,
  computeInternalContextRichness01,
  countTimelineMealsWithMacroSignalsV1,
  GLUCOSE_STIMULUS_PREDICTOR_SOURCE_PREFIX,
  INSULIN_STIMULUS_PREDICTOR_SOURCE_PREFIX,
  LACTATE_STIMULUS_PREDICTOR_SOURCE_PREFIX,
  hourlyFlat24,
  hourFromIsoTs,
  mealGlycemicHourWeights24,
  scaleSimulatedLabNumericForSkeletonPartialV1,
  simulatedLabNumeric,
  SIM_DIURNAL_SUBHOURLY_SOURCE_PREFIX,
  type MetabolicNodeCoherenceV1,
  type SimTimelineEventV1,
} from "@empathy/domain-bioenergetics";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 0–1 da pasti con CHO/kcal elevati → modulazione diurna cortisolo/ACTH (`SIM_CORTISOL_MEAL_MOD_V1`, roadmap 2.2). */
export function postprandialMealLoad01ForCortisolMod(timeline: BioenergeticTimelineEvent[]): number {
  let max = 0;
  for (const e of timeline) {
    if (e.type !== "meal") continue;
    const payload = e.payload as { carbsG?: unknown; kcal?: unknown } | undefined;
    const c = typeof payload?.carbsG === "number" ? payload.carbsG : Number(payload?.carbsG);
    const cal = typeof payload?.kcal === "number" ? payload.kcal : Number(payload?.kcal);
    const cScore = Number.isFinite(c) && c > 0 ? Math.min(1, c / 115) : 0;
    const kScore = Number.isFinite(cal) && cal > 0 ? Math.min(1, cal / 950) : 0;
    const combined = 0.55 * cScore + 0.45 * kScore;
    if (combined > max) max = combined;
  }
  return Math.round(100 * Math.min(1, max)) / 100;
}

function isHighFrequencyStream(
  provenance: BioenergeticChannelProvenance,
  points: BioenergeticSeriesPoint[] | null,
): boolean {
  return provenance === "measured" && (points?.length ?? 0) > 3;
}

function monitoringPlaneForGluLac(
  provenance: BioenergeticChannelProvenance,
  points: BioenergeticSeriesPoint[] | null,
): BioenergeticMonitoringDataPlane {
  if (isHighFrequencyStream(provenance, points)) return "measured_stream";
  if (provenance === "measured") return "sparse_lab_hold";
  return "model_continuous";
}

/**
 * Traccia nativa per grafico continuo: stream CGM reale **oppure** modello diurno sub-orario deterministico
 * (`glucose_stimulus_predictor_v1_*m` / `lactate_stimulus_predictor_v1_*m` / `insulin_stimulus_predictor_v1_*m`; legacy `sim_diurnal_v1_*m` se presente).
 * Solo motore deterministico + presentazione; nessuna curva LLM come `source` di questi punti.
 */
function monitoringStreamTraceFromPoints(
  provenance: BioenergeticChannelProvenance,
  points: BioenergeticSeriesPoint[] | null,
): BioenergeticMonitoringStreamPoint[] | undefined {
  if (!points?.length) return undefined;
  if (isHighFrequencyStream(provenance, points)) {
    return [...points]
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .map((p) => ({ observedAt: p.ts, value: p.value }));
  }
  if (provenance === "estimated" && isDenseSimDiurnalSeries(points)) {
    return [...points]
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .map((p) => ({ observedAt: p.ts, value: p.value }));
  }
  return undefined;
}

function mergeLabSim(
  labVal: number | null,
  tileId: string,
  k: BioenergeticDayKernelOutput,
): { numeric: number | null; provenance: BioenergeticChannelProvenance } {
  if (labVal != null) return { numeric: labVal, provenance: "measured" };
  const s = simulatedLabNumeric(tileId, k);
  if (s != null) return { numeric: s, provenance: "estimated" };
  return { numeric: null, provenance: "absent" };
}

function skeletonObservability(
  nodes: readonly MetabolicNodeCoherenceV1[] | null | undefined,
  nodeId: string,
): MetabolicNodeCoherenceV1["observability"] | null {
  if (!nodes?.length) return null;
  const n = nodes.find((x) => x.nodeId === nodeId);
  return n?.observability ?? null;
}

/**
 * Lab vince sempre; senza lab: `blocked` → tile `absent`; `partial` → sim attenuata (`SIM_LAB_TILE_PARTIAL_SCALE_V1`);
 * `high` o nodo assente → sim piena come `mergeLabSim`.
 */
function mergeLabSimRespectingSkeleton(
  labVal: number | null,
  tileIdForSim: string,
  skeletonNodeId: string,
  k: BioenergeticDayKernelOutput,
  interactionNodes: readonly MetabolicNodeCoherenceV1[] | null | undefined,
): { numeric: number | null; provenance: BioenergeticChannelProvenance } {
  if (labVal != null) return { numeric: labVal, provenance: "measured" };
  const obs = skeletonObservability(interactionNodes, skeletonNodeId);
  if (obs === "blocked") return { numeric: null, provenance: "absent" };
  const sim = simulatedLabNumeric(tileIdForSim, k);
  if (sim == null) return { numeric: null, provenance: "absent" };
  if (obs === "partial") {
    return { numeric: scaleSimulatedLabNumericForSkeletonPartialV1(sim), provenance: "estimated" };
  }
  return { numeric: sim, provenance: "estimated" };
}

function mergeLabValues(rows: Array<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const v = row.values;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, v as Record<string, unknown>);
    }
  }
  return out;
}

function pickNum(lab: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const raw = lab[k];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "") {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

/** Allinea a `health-ontology` / decode VLM: mmol espliciti o glicemia in mg/dL. */
export function pickGlucoseMmolFromLab(lab: Record<string, unknown>): number | null {
  const mm = pickNum(lab, ["glucose_mmol_l", "glucose_mmol", "fasting_glucose_mmol", "fbg_mmol"]);
  if (mm != null && mm > 0 && mm <= 35) return mm;
  const mg = pickNum(lab, ["glicemia", "glucose_mg_dl", "glucose_mg", "blood_glucose_mg_dl", "fasting_glucose"]);
  if (mg != null && mg > 30) return mg / 18.018;
  const ambiguous = pickNum(lab, ["glucose"]);
  if (ambiguous != null && ambiguous > 30) return ambiguous / 18.018;
  if (ambiguous != null && ambiguous >= 2 && ambiguous <= 15) return ambiguous;
  return null;
}

function firstBiomarkerGlucosePoint(
  rows: Array<Record<string, unknown>>,
  date: string,
): BioenergeticSeriesPoint | null {
  for (const row of rows) {
    const vr = row.values;
    if (!vr || typeof vr !== "object" || Array.isArray(vr)) continue;
    const mmol = pickGlucoseMmolFromLab(vr as Record<string, unknown>);
    if (mmol == null) continue;
    const sd =
      typeof row.sample_date === "string" && String(row.sample_date).trim()
        ? String(row.sample_date).slice(0, 10)
        : date;
    const ca = typeof row.created_at === "string" && row.created_at ? row.created_at : null;
    const ts = ca && ca.includes("T") ? ca : `${sd}T08:30:00`;
    return { ts, value: mmol, source: "lab_panel" };
  }
  return null;
}

function firstBiomarkerLactatePoint(
  rows: Array<Record<string, unknown>>,
  date: string,
): BioenergeticSeriesPoint | null {
  for (const row of rows) {
    const vr = row.values;
    if (!vr || typeof vr !== "object" || Array.isArray(vr)) continue;
    const lac = pickNum(vr as Record<string, unknown>, ["lactate_mmol_l", "lactate_mmoll", "lactate"]);
    if (lac == null || !Number.isFinite(lac)) continue;
    const sd =
      typeof row.sample_date === "string" && String(row.sample_date).trim()
        ? String(row.sample_date).slice(0, 10)
        : date;
    const ca = typeof row.created_at === "string" && row.created_at ? row.created_at : null;
    const ts = ca && ca.includes("T") ? ca : `${sd}T09:15:00`;
    return { ts, value: lac, source: "lab_panel" };
  }
  return null;
}

function impactFromCrpMgL(v: number): BioenergeticPathwayImpact {
  if (v <= 1) return "supportive";
  if (v <= 3) return "neutral";
  return "inhibitory";
}

function impactFromGlucoseMmol(v: number): BioenergeticPathwayImpact {
  if (v >= 4.0 && v <= 6.2) return "supportive";
  if (v >= 3.3 && v <= 7.8) return "neutral";
  return "inhibitory";
}

function impactFromLactateMmol(v: number, activityLoad: number): BioenergeticPathwayImpact {
  if (activityLoad >= 40 && v >= 2 && v <= 12) return "supportive";
  if (v < 2.2) return "supportive";
  if (v <= 3.5) return "neutral";
  return "inhibitory";
}

/** Valore presente da referto: impatto neutro salvo range estremi (euristica educativa, non clinica). */
function impactLabPresentModerate(v: number, low: number, high: number): BioenergeticPathwayImpact {
  if (v >= low && v <= high) return "supportive";
  if (v >= low * 0.85 && v <= high * 1.15) return "neutral";
  return "inhibitory";
}

function formatNum(v: number, decimals = 1): string {
  return String(Math.round(v * 10 ** decimals) / 10 ** decimals);
}

function latestSeriesValue(points: BioenergeticSeriesPoint[] | null): number | null {
  if (!points?.length) return null;
  const last = points[points.length - 1];
  return typeof last.value === "number" && Number.isFinite(last.value) ? last.value : null;
}

function interpolateNumericSeriesByHour(
  _date: string,
  points: BioenergeticSeriesPoint[] | null,
  fallback: number | null,
): (number | null)[] {
  const byHour = Array.from({ length: 24 }, () => null as number | null);
  if (!points?.length) {
    if (fallback != null) byHour.fill(fallback);
    return byHour;
  }
  const sorted = [...points].sort((a, b) => a.ts.localeCompare(b.ts));
  const vals: { h: number; v: number }[] = [];
  for (const p of sorted) {
    const h = hourFromIsoTs(p.ts);
    if (h == null) continue;
    vals.push({ h, v: p.value });
  }
  if (!vals.length) {
    if (fallback != null) byHour.fill(fallback);
    return byHour;
  }
  for (let h = 0; h < 24; h += 1) {
    let prev: { h: number; v: number } | null = null;
    let next: { h: number; v: number } | null = null;
    for (const x of vals) {
      if (x.h <= h) prev = x;
      if (x.h >= h) {
        next = x;
        break;
      }
    }
    if (prev && next && prev.h !== next.h) {
      const t = (h - prev.h) / (next.h - prev.h);
      byHour[h] = prev.v + t * (next.v - prev.v);
    } else if (prev) byHour[h] = prev.v;
    else if (next) byHour[h] = next.v;
  }
  return byHour;
}

/** Media oraria da serie densa (es. sim 10 min) per `chart24h` senza collassare più campioni nella stessa ora. */
function hourlyMeansFromDensePoints(points: BioenergeticSeriesPoint[]): (number | null)[] {
  const buckets: number[][] = Array.from({ length: 24 }, () => []);
  for (const p of points) {
    const h = hourFromIsoTs(p.ts);
    if (h == null || !Number.isFinite(p.value)) continue;
    buckets[h]!.push(p.value);
  }
  return buckets.map((b) => (b.length ? b.reduce((a, c) => a + c, 0) / b.length : null));
}

function isDenseSimDiurnalSeries(points: BioenergeticSeriesPoint[] | null): boolean {
  if (!points?.length || points.length < 72) return false;
  return points.some((p) => {
    const s = typeof p.source === "string" ? p.source : "";
    return (
      s.startsWith(SIM_DIURNAL_SUBHOURLY_SOURCE_PREFIX) ||
      s.startsWith(GLUCOSE_STIMULUS_PREDICTOR_SOURCE_PREFIX) ||
      s.startsWith(LACTATE_STIMULUS_PREDICTOR_SOURCE_PREFIX) ||
      s.startsWith(INSULIN_STIMULUS_PREDICTOR_SOURCE_PREFIX)
    );
  });
}

/**
 * Deforma le serie orarie glucosio/lattato in base a timeline pasti / sedute (stessi pesi di `mealGlycemicHourWeights24` e `activitySupportHours`).
 * Con stream denso (CGM molti punti) il bump pasto su glucosio è attenuato per non duplicare ciò che il device cattura già; il lattato in allenamento resta leggermente modulabile.
 */
export function applyTimelineContextToGluLacHourly24(input: {
  glucose: (number | null)[];
  lactate: (number | null)[];
  mealW: readonly number[];
  activityH: ReadonlySet<number>;
  glucoseDenseStream: boolean;
  lactateDenseStream: boolean;
  /** Serie 5/10 min da sim v1 già modellata: non duplicare bump pasto/orario su aggregato orario. */
  skipMealGlucoseHourlyBecauseSubhourlySim?: boolean;
  skipLactateTrainHourlyBecauseSubhourlySim?: boolean;
  insulinDemandScore: number;
  oxidationDriveScore: number;
}): { glucose: (number | null)[]; lactate: (number | null)[] } {
  const gOut = [...input.glucose];
  const lOut = [...input.lactate];
  const insK = clamp(input.insulinDemandScore / 100, 0, 1);
  const oxK = clamp(input.oxidationDriveScore / 100, 0, 1);
  const mealGlucoseScale =
    input.glucoseDenseStream || input.skipMealGlucoseHourlyBecauseSubhourlySim ? 0 : 1;
  const lactateTrainScale = input.lactateDenseStream
    ? 0.22
    : input.skipLactateTrainHourlyBecauseSubhourlySim
      ? 0
      : 1;

  for (let h = 0; h < 24; h += 1) {
    const mw = input.mealW[h] ?? 0;
    let g = gOut[h];
    if (g != null && Number.isFinite(g) && mealGlucoseScale > 0 && mw > 0.04) {
      const clearance = 1 - 0.24 * insK;
      const bump = 0.58 * Math.min(1.2, mw * 0.5) * clearance;
      g = clamp(g + bump, 2.8, 14);
      gOut[h] = Math.round(g * 1000) / 1000;
    }
  }

  for (let h = 0; h < 24; h += 1) {
    const mw = input.mealW[h] ?? 0;
    let g = gOut[h];
    if (g != null && Number.isFinite(g) && input.activityH.has(h) && mw < 0.1) {
      const dipScale = input.glucoseDenseStream ? 0.25 : 1;
      const dip = (0.1 + oxK * 0.18) * dipScale;
      g = clamp(g - dip, 2.8, 14);
      gOut[h] = Math.round(g * 1000) / 1000;
    }
  }

  for (let h = 0; h < 24; h += 1) {
    let l = lOut[h];
    if (l != null && Number.isFinite(l) && input.activityH.has(h)) {
      const bumpL = (0.38 + oxK * 1.05) * lactateTrainScale;
      l = clamp(l + bumpL, 0.35, 18);
      lOut[h] = Math.round(l * 1000) / 1000;
    }
  }

  return { glucose: gOut, lactate: lOut };
}

export function buildBioenergeticDayPresentation(input: {
  date: string;
  kernel: BioenergeticDayKernelOutput;
  provenance: { glucose: BioenergeticChannelProvenance; lactate: BioenergeticChannelProvenance };
  channels: {
    glucose: BioenergeticSeriesPoint[] | null;
    lactate: BioenergeticSeriesPoint[] | null;
    insulinProxyDense?: BioenergeticSeriesPoint[] | null;
  };
  timeline: BioenergeticTimelineEvent[];
  biomarkerRows: Array<Record<string, unknown>>;
  /** Da `buildMetabolicEndocrineInteractionReportV1`; se assente resta il comportamento storico (sim su tile). */
  interactionNodes?: readonly MetabolicNodeCoherenceV1[] | null;
  /** Se true: non costruisce la striscia monitoring (canali vuoti); va riempita da OpenAI in assembler. */
  omitMonitoringStrip?: boolean;
}): {
  metricTiles: BioenergeticMetricTile[];
  chart24h: BioenergeticHour24Point[];
  continuousMonitoring: BioenergeticContinuousMonitoringDay;
} {
  const lab = mergeLabValues(input.biomarkerRows);
  const k = input.kernel;
  const skNodes = input.interactionNodes;
  const baseBalance = clamp(k.oxidationDriveScore - k.insulinDemandScore, -55, 55);
  const mealW = mealGlycemicHourWeights24(input.timeline);
  const activityH = activitySupportHours(input.timeline);
  const activityLoad = clamp(k.oxidationDriveScore * 0.6 + k.glucoseHandlingScore * 0.2, 0, 100);

  const chG = input.channels.glucose;
  const labGlucosePoint = firstBiomarkerGlucosePoint(input.biomarkerRows, input.date);
  const gLabMerged = pickGlucoseMmolFromLab(lab);
  const chLatest = latestSeriesValue(chG);

  let gLatest: number | null;
  let gTileProv: BioenergeticChannelProvenance;
  if (input.provenance.glucose === "measured" && chLatest != null) {
    gLatest = chLatest;
    gTileProv = "measured";
  } else if (gLabMerged != null) {
    gLatest = gLabMerged;
    gTileProv = "measured";
  } else {
    gLatest = chLatest;
    gTileProv = input.provenance.glucose;
  }

  const glucosePointsForInterp =
    input.provenance.glucose === "measured" && chG?.length
      ? chG
      : labGlucosePoint
        ? [labGlucosePoint]
        : chG?.length
          ? chG
          : null;

  const lactatePoints = input.channels.lactate;
  const lacLabPoint = firstBiomarkerLactatePoint(input.biomarkerRows, input.date);
  const lactatePointsForInterp =
    input.provenance.lactate === "measured" && lactatePoints?.length
      ? lactatePoints
      : lacLabPoint
        ? [lacLabPoint]
        : lactatePoints?.length
          ? lactatePoints
          : null;
  const chIns = input.channels.insulinProxyDense ?? null;
  const simTl = input.timeline as readonly SimTimelineEventV1[];
  const glucoseDense = isHighFrequencyStream(input.provenance.glucose, chG);
  const lacDense = isHighFrequencyStream(input.provenance.lactate, lactatePoints);
  const lFromLab = pickNum(lab, ["lactate_mmol_l", "lactate_mmoll", "lactate"]);
  const chL = latestSeriesValue(lactatePoints);
  let lVal: number | null;
  let lTileProv: BioenergeticChannelProvenance;
  if (input.provenance.lactate === "measured" && chL != null) {
    lVal = chL;
    lTileProv = "measured";
  } else if (lFromLab != null) {
    lVal = lFromLab;
    lTileProv = "measured";
  } else {
    lVal = chL;
    lTileProv = input.provenance.lactate;
  }

  let glucoseHourly: (number | null)[];
  if (glucosePointsForInterp && isDenseSimDiurnalSeries(glucosePointsForInterp)) {
    glucoseHourly = hourlyMeansFromDensePoints(glucosePointsForInterp);
  } else {
    glucoseHourly = interpolateNumericSeriesByHour(
      input.date,
      glucosePointsForInterp,
      gLatest ?? (gTileProv === "estimated" ? 5.4 + k.insulinDemandScore * 0.015 : null),
    );
  }

  let lactateHourly: (number | null)[];
  if (lactatePointsForInterp && isDenseSimDiurnalSeries(lactatePointsForInterp)) {
    lactateHourly = hourlyMeansFromDensePoints(lactatePointsForInterp);
  } else {
    lactateHourly = interpolateNumericSeriesByHour(
      input.date,
      lactatePointsForInterp,
      lVal ?? (lTileProv === "estimated" ? 1.1 + k.oxidationDriveScore * 0.01 : null),
    );
  }

  const insulinDenseMeans =
    chIns && chIns.length >= 72 && isDenseSimDiurnalSeries(chIns) ? hourlyMeansFromDensePoints(chIns) : null;
  const insulinHourlyFallback = buildInsulinProxyHourly24(input.date, k, simTl);
  const insulinHourlyForStrip: (number | null)[] =
    insulinDenseMeans != null ? insulinDenseMeans : insulinHourlyFallback;

  const skipMealGlucoseHourlyBecauseSubhourlySim =
    Boolean(glucosePointsForInterp?.length) &&
    isDenseSimDiurnalSeries(glucosePointsForInterp) &&
    input.provenance.glucose === "estimated";
  const skipLactateTrainHourlyBecauseSubhourlySim =
    Boolean(lactatePointsForInterp?.length) &&
    isDenseSimDiurnalSeries(lactatePointsForInterp) &&
    input.provenance.lactate === "estimated";

  const gluLacMod = applyTimelineContextToGluLacHourly24({
    glucose: glucoseHourly,
    lactate: lactateHourly,
    mealW,
    activityH,
    glucoseDenseStream: glucoseDense,
    lactateDenseStream: lacDense,
    skipMealGlucoseHourlyBecauseSubhourlySim,
    skipLactateTrainHourlyBecauseSubhourlySim,
    insulinDemandScore: k.insulinDemandScore,
    oxidationDriveScore: k.oxidationDriveScore,
  });
  glucoseHourly = gluLacMod.glucose;
  lactateHourly = gluLacMod.lactate;

  const chart24h: BioenergeticHour24Point[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const circ = 12 * Math.sin(((hour - 6) * Math.PI) / 12);
    let bal = baseBalance + circ;
    if (mealW[hour] > 0.1) bal -= 30 * Math.min(1.15, mealW[hour] * 0.52);
    if (activityH.has(hour)) bal += 24;
    bal = clamp(bal, -100, 100);
    let impact: BioenergeticPathwayImpact;
    if (bal >= 18) impact = "supportive";
    else if (bal <= -18) impact = "inhibitory";
    else impact = "neutral";
    const g = glucoseHourly[hour];
    const lacH = lactateHourly[hour];
    chart24h.push({
      hour,
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
      pathwayBalance: Math.round(bal * 10) / 10,
      pathwayImpact: impact,
      glucoseMmol: g,
      lactateMmol: lacH,
    });
  }

  const nomH = buildNominalCortisolActhHourly24(k, {
    postprandialMealLoad01: postprandialMealLoad01ForCortisolMod(input.timeline),
  });
  const nomThy = buildNominalThyroidTshFt4Hourly24(k);
  const nomGhGre = buildNominalGhGhrelinHourly24(k, simTl);
  const nomIgfLep = buildNominalIgf1LeptinHourly24(k, simTl);

  const insulinProxy = clamp(k.insulinDemandScore, 0, 100);
  const tiles: BioenergeticMetricTile[] = [];

  const pushTile = (t: Omit<BioenergeticMetricTile, "id"> & { id: string }) => {
    tiles.push(t);
  };

  pushTile({
    id: "glucose",
    labelIt: "Glucosio",
    unit: "mmol/L",
    displayValue: gLatest != null ? formatNum(gLatest, 2) : "—",
    numericValue: gLatest,
    provenance: gTileProv,
    impact: gLatest != null ? impactFromGlucoseMmol(gLatest) : "neutral",
    category: "metabolic",
  });

  pushTile({
    id: "lactate",
    labelIt: "Lattato",
    unit: "mmol/L",
    displayValue: lVal != null ? formatNum(lVal, 2) : "—",
    numericValue: lVal,
    provenance: lTileProv,
    impact: lVal != null ? impactFromLactateMmol(lVal, activityLoad) : "neutral",
    category: "metabolic",
  });

  pushTile({
    id: "insulin_proxy",
    labelIt: "Domanda insulinica (proxy)",
    unit: "score 0–100",
    displayValue: formatNum(insulinProxy, 0),
    numericValue: insulinProxy,
    provenance: "estimated",
    impact: insulinProxy < 38 ? "supportive" : insulinProxy < 62 ? "neutral" : "inhibitory",
    category: "metabolic",
  });

  const crpM = mergeLabSim(pickNum(lab, ["crp_mg_l", "crp", "hs_crp", "hscrp"]), "crp", k);
  pushTile({
    id: "crp",
    labelIt: "PCR-us (contesto)",
    unit: "mg/L",
    displayValue: crpM.numeric != null ? formatNum(crpM.numeric, 2) : "—",
    numericValue: crpM.numeric,
    provenance: crpM.provenance,
    impact: crpM.numeric != null ? impactFromCrpMgL(crpM.numeric) : "neutral",
    category: "inflammatory",
  });

  const tTestoM = mergeLabSim(pickNum(lab, ["testosterone", "testosterone_ng_dl", "testosterone_total"]), "testosterone", k);
  pushTile({
    id: "testosterone",
    labelIt: "Testosterone",
    unit: "ng/dL",
    displayValue: tTestoM.numeric != null ? formatNum(tTestoM.numeric, 0) : "—",
    numericValue: tTestoM.numeric,
    provenance: tTestoM.provenance,
    impact: tTestoM.numeric != null ? impactLabPresentModerate(tTestoM.numeric, 300, 900) : "neutral",
    category: "hormonal",
  });

  const ftM = mergeLabSim(pickNum(lab, ["free_testosterone", "testosterone_free", "testosterone_free_pg_ml"]), "free_testosterone", k);
  pushTile({
    id: "free_testosterone",
    labelIt: "Testosterone libero",
    unit: "pg/mL",
    displayValue: ftM.numeric != null ? formatNum(ftM.numeric, 1) : "—",
    numericValue: ftM.numeric,
    provenance: ftM.provenance,
    impact: ftM.numeric != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const tshM = mergeLabSim(pickNum(lab, ["tsh", "tsh_mui_l", "tsh_miu_l"]), "tsh", k);
  pushTile({
    id: "tsh",
    labelIt: "TSH",
    unit: "mUI/L",
    displayValue: tshM.numeric != null ? formatNum(tshM.numeric, 2) : "—",
    numericValue: tshM.numeric,
    provenance: tshM.provenance,
    impact: tshM.numeric != null ? impactLabPresentModerate(tshM.numeric, 0.5, 4.0) : "neutral",
    category: "hormonal",
  });

  const ft3M = mergeLabSim(pickNum(lab, ["ft3", "t3", "free_t3"]), "ft3", k);
  pushTile({
    id: "ft3",
    labelIt: "T3 / FT3",
    unit: "pg/mL",
    displayValue: ft3M.numeric != null ? formatNum(ft3M.numeric, 1) : "—",
    numericValue: ft3M.numeric,
    provenance: ft3M.provenance,
    impact: ft3M.numeric != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const ft4M = mergeLabSim(pickNum(lab, ["ft4", "ft4_ng_dl", "free_t4", "t4"]), "ft4", k);
  pushTile({
    id: "ft4",
    labelIt: "T4 libera / T4",
    unit: "ng/dL",
    displayValue: ft4M.numeric != null ? formatNum(ft4M.numeric, 2) : "—",
    numericValue: ft4M.numeric,
    provenance: ft4M.provenance,
    impact: ft4M.numeric != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const cortisolM = mergeLabSim(pickNum(lab, ["cortisol_am", "cortisol_pm", "cortisol", "cortisol_ug_dl"]), "cortisol", k);
  pushTile({
    id: "cortisol",
    labelIt: "Cortisolo",
    unit: "µg/dL",
    displayValue: cortisolM.numeric != null ? formatNum(cortisolM.numeric, 1) : "—",
    numericValue: cortisolM.numeric,
    provenance: cortisolM.provenance,
    impact: cortisolM.numeric != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const acthM = mergeLabSim(pickNum(lab, ["acth", "acth_pg_ml"]), "acth", k);
  pushTile({
    id: "acth",
    labelIt: "ACTH",
    unit: "pg/mL",
    displayValue: acthM.numeric != null ? formatNum(acthM.numeric, 1) : "—",
    numericValue: acthM.numeric,
    provenance: acthM.provenance,
    impact: acthM.numeric != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const ghM = mergeLabSimRespectingSkeleton(pickNum(lab, ["gh", "growth_hormone", "hgh"]), "gh", "gh_pulse", k, skNodes);
  pushTile({
    id: "gh",
    labelIt: "GH",
    unit: "ng/mL",
    displayValue: ghM.numeric != null ? formatNum(ghM.numeric, 2) : "—",
    numericValue: ghM.numeric,
    provenance: ghM.provenance,
    impact: ghM.numeric != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const igfM = mergeLabSim(pickNum(lab, ["igf1", "igf_1", "igf1_ng_ml"]), "igf1", k);
  pushTile({
    id: "igf1",
    labelIt: "IGF-1",
    unit: "ng/mL",
    displayValue: igfM.numeric != null ? formatNum(igfM.numeric, 0) : "—",
    numericValue: igfM.numeric,
    provenance: igfM.provenance,
    impact: igfM.numeric != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const dheaM = mergeLabSim(pickNum(lab, ["dhea_s", "dhea", "dhea_ug_dl"]), "dhea", k);
  pushTile({
    id: "dhea",
    labelIt: "DHEA-S / DHEA",
    unit: "µg/dL",
    displayValue: dheaM.numeric != null ? formatNum(dheaM.numeric, 0) : "—",
    numericValue: dheaM.numeric,
    provenance: dheaM.provenance,
    impact: dheaM.numeric != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const progM = mergeLabSim(pickNum(lab, ["progesterone", "progesterone_ng_ml"]), "progesterone", k);
  pushTile({
    id: "progesterone",
    labelIt: "Progesterone",
    unit: "ng/mL",
    displayValue: progM.numeric != null ? formatNum(progM.numeric, 2) : "—",
    numericValue: progM.numeric,
    provenance: progM.provenance,
    impact: progM.numeric != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const prolM = mergeLabSim(pickNum(lab, ["prolactin", "prolactin_ng_ml"]), "prolactin", k);
  pushTile({
    id: "prolactin",
    labelIt: "Prolattina",
    unit: "ng/mL",
    displayValue: prolM.numeric != null ? formatNum(prolM.numeric, 1) : "—",
    numericValue: prolM.numeric,
    provenance: prolM.provenance,
    impact: prolM.numeric != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const homaM = mergeLabSim(pickNum(lab, ["homa_ir", "homa", "homa_index"]), "homa_ir", k);
  pushTile({
    id: "homa_ir",
    labelIt: "HOMA-IR",
    unit: "indice",
    displayValue: homaM.numeric != null ? formatNum(homaM.numeric, 2) : "—",
    numericValue: homaM.numeric,
    provenance: homaM.provenance,
    impact: homaM.numeric != null ? impactLabPresentModerate(homaM.numeric, 0.8, 2.2) : "neutral",
    category: "hormonal",
  });

  const insulinLabM = mergeLabSimRespectingSkeleton(
    pickNum(lab, ["insulin", "insulin_mui_ml", "insulin_uiu_ml", "fasting_insulin"]),
    "insulin_lab",
    "insulin_demand",
    k,
    skNodes,
  );
  pushTile({
    id: "insulin_lab",
    labelIt: "Insulina (lab)",
    unit: "µUI/mL",
    displayValue: insulinLabM.numeric != null ? formatNum(insulinLabM.numeric, 1) : "—",
    numericValue: insulinLabM.numeric,
    provenance: insulinLabM.provenance,
    impact: insulinLabM.numeric != null ? impactLabPresentModerate(insulinLabM.numeric, 3, 25) : "neutral",
    category: "hormonal",
  });

  const gabaM = mergeLabSim(pickNum(lab, ["gaba", "gaba_umol_l"]), "gaba", k);
  const seroM = mergeLabSim(pickNum(lab, ["serotonin", "serotonina", "5_ht"]), "serotonin", k);
  const dopaM = mergeLabSim(pickNum(lab, ["dopamine", "dopamina"]), "dopamine", k);
  pushTile({
    id: "gaba",
    labelIt: "GABA (contesto)",
    unit: "a.u.",
    displayValue: gabaM.numeric != null ? formatNum(gabaM.numeric, 2) : "—",
    numericValue: gabaM.numeric,
    provenance: gabaM.provenance,
    impact: "neutral",
    category: "neural",
  });
  pushTile({
    id: "serotonin",
    labelIt: "Serotonina",
    unit: "a.u.",
    displayValue: seroM.numeric != null ? formatNum(seroM.numeric, 2) : "—",
    numericValue: seroM.numeric,
    provenance: seroM.provenance,
    impact: "neutral",
    category: "neural",
  });
  pushTile({
    id: "dopamine",
    labelIt: "Dopamina",
    unit: "a.u.",
    displayValue: dopaM.numeric != null ? formatNum(dopaM.numeric, 2) : "—",
    numericValue: dopaM.numeric,
    provenance: dopaM.provenance,
    impact: "neutral",
    category: "neural",
  });

  const gastrinM = mergeLabSim(pickNum(lab, ["gastrin", "gastrin_pg_ml"]), "gastrin", k);
  const ghrelinM = mergeLabSimRespectingSkeleton(pickNum(lab, ["ghrelin", "ghrelin_pg_ml"]), "ghrelin", "ghrelin", k, skNodes);
  const leptinM = mergeLabSimRespectingSkeleton(pickNum(lab, ["leptin", "leptin_ng_ml"]), "leptin", "leptin_energy_balance", k, skNodes);
  pushTile({
    id: "gastrin",
    labelIt: "Gastrina",
    unit: "pg/mL",
    displayValue: gastrinM.numeric != null ? formatNum(gastrinM.numeric, 0) : "—",
    numericValue: gastrinM.numeric,
    provenance: gastrinM.provenance,
    impact: "neutral",
    category: "gastro_intestinal",
  });
  pushTile({
    id: "ghrelin",
    labelIt: "Ghrelina",
    unit: "pg/mL",
    displayValue: ghrelinM.numeric != null ? formatNum(ghrelinM.numeric, 0) : "—",
    numericValue: ghrelinM.numeric,
    provenance: ghrelinM.provenance,
    impact: "neutral",
    category: "gastro_intestinal",
  });
  pushTile({
    id: "leptin",
    labelIt: "Leptina",
    unit: "ng/mL",
    displayValue: leptinM.numeric != null ? formatNum(leptinM.numeric, 1) : "—",
    numericValue: leptinM.numeric,
    provenance: leptinM.provenance,
    impact: "neutral",
    category: "gastro_intestinal",
  });

  const lhM = mergeLabSim(pickNum(lab, ["lh", "lh_miu_ml"]), "lh", k);
  const fshM = mergeLabSim(pickNum(lab, ["fsh", "fsh_miu_ml"]), "fsh", k);
  const estradiolM = mergeLabSim(pickNum(lab, ["estradiol", "estradiol_pg_ml"]), "estradiol", k);
  pushTile({
    id: "lh",
    labelIt: "LH",
    unit: "mUI/mL",
    displayValue: lhM.numeric != null ? formatNum(lhM.numeric, 1) : "—",
    numericValue: lhM.numeric,
    provenance: lhM.provenance,
    impact: "neutral",
    category: "gonadal",
  });
  pushTile({
    id: "fsh",
    labelIt: "FSH",
    unit: "mUI/mL",
    displayValue: fshM.numeric != null ? formatNum(fshM.numeric, 1) : "—",
    numericValue: fshM.numeric,
    provenance: fshM.provenance,
    impact: "neutral",
    category: "gonadal",
  });
  pushTile({
    id: "estradiol",
    labelIt: "Estradiolo",
    unit: "pg/mL",
    displayValue: estradiolM.numeric != null ? formatNum(estradiolM.numeric, 0) : "—",
    numericValue: estradiolM.numeric,
    provenance: estradiolM.provenance,
    impact: "neutral",
    category: "gonadal",
  });

  let continuousMonitoring: BioenergeticContinuousMonitoringDay;
  if (input.omitMonitoringStrip) {
    continuousMonitoring = { layer: "model_continuous_v1", channels: [] };
  } else {
    const internalRichness = computeInternalContextRichness01(input.timeline, input.biomarkerRows.length);
    const glucoseSparseLabPoint =
      !glucoseDense &&
      (gLabMerged != null ||
        labGlucosePoint != null ||
        (input.provenance.glucose === "measured" && (chG?.length ?? 0) > 0 && (chG?.length ?? 0) <= 3));
    const glucoseCurveResolution = arbitrateGlucoseCurveFusionV1({
      hasDenseMeasuredStream: glucoseDense,
      hasSparseLabPoint: glucoseSparseLabPoint,
      internalContextRichness01: internalRichness,
    });

    const lacSparseLabPoint =
      !lacDense &&
      (lFromLab != null ||
        lacLabPoint != null ||
        (input.provenance.lactate === "measured" && (lactatePoints?.length ?? 0) > 0 && (lactatePoints?.length ?? 0) <= 3));
    const lactateCurveResolution = arbitrateLactateCurveFusionV1({
      hasDenseMeasuredStream: lacDense,
      hasSparseLabPoint: lacSparseLabPoint,
      internalContextRichness01: internalRichness,
    });

    const insulinCurveResolution = arbitrateInsulinProxyCurveFusionV1(countTimelineMealsWithMacroSignalsV1(input.timeline));

    const cortisolCurveResolution =
      cortisolM.provenance === "measured"
        ? arbitrateLabHoldHormoneCurveFusionV1("cortisol")
        : arbitrateNominalHormoneCurveFusionV1("cortisol", internalRichness);
    const acthCurveResolution =
      acthM.provenance === "measured" ? arbitrateLabHoldHormoneCurveFusionV1("acth") : arbitrateNominalHormoneCurveFusionV1("acth", internalRichness);
    const tshCurveResolution =
      tshM.provenance === "measured" ? arbitrateLabHoldHormoneCurveFusionV1("tsh") : arbitrateNominalHormoneCurveFusionV1("tsh", internalRichness);
    const ft4CurveResolution =
      ft4M.provenance === "measured" ? arbitrateLabHoldHormoneCurveFusionV1("ft4") : arbitrateNominalHormoneCurveFusionV1("ft4", internalRichness);
    const ghCurveResolution =
      ghM.provenance === "measured" ? arbitrateLabHoldHormoneCurveFusionV1("gh") : arbitrateNominalHormoneCurveFusionV1("gh", internalRichness);
    const ghrelinCurveResolution =
      ghrelinM.provenance === "measured"
        ? arbitrateLabHoldHormoneCurveFusionV1("ghrelin")
        : arbitrateNominalHormoneCurveFusionV1("ghrelin", internalRichness);
    const igf1CurveResolution =
      igfM.provenance === "measured" ? arbitrateLabHoldHormoneCurveFusionV1("igf1") : arbitrateNominalHormoneCurveFusionV1("igf1", internalRichness);
    const leptinCurveResolution =
      leptinM.provenance === "measured"
        ? arbitrateLabHoldHormoneCurveFusionV1("leptin")
        : arbitrateNominalHormoneCurveFusionV1("leptin", internalRichness);

    const monitoringChannels: BioenergeticMonitoringChannel24[] = [
      {
        id: "glucose",
        labelIt: "Glucosio",
        unit: "mmol/L",
        category: "metabolic",
        hourly: glucoseHourly,
        streamTrace: monitoringStreamTraceFromPoints(input.provenance.glucose, chG),
        dataPlane: monitoringPlaneForGluLac(input.provenance.glucose, chG),
        replacesWithDeviceStream: true,
        curveResolution: glucoseCurveResolution,
      },
      {
        id: "lactate",
        labelIt: "Lattato",
        unit: "mmol/L",
        category: "metabolic",
        hourly: lactateHourly,
        streamTrace: monitoringStreamTraceFromPoints(input.provenance.lactate, lactatePoints),
        dataPlane: monitoringPlaneForGluLac(input.provenance.lactate, lactatePoints),
        replacesWithDeviceStream: true,
        curveResolution: lactateCurveResolution,
      },
      {
        id: "insulin_proxy",
        labelIt: "Domanda insulinica (proxy)",
        unit: "score 0–100",
        category: "metabolic",
        hourly: insulinHourlyForStrip,
        streamTrace:
          chIns && isDenseSimDiurnalSeries(chIns)
            ? monitoringStreamTraceFromPoints("estimated", chIns)
            : undefined,
        dataPlane: "model_continuous",
        replacesWithDeviceStream: true,
        curveResolution: insulinCurveResolution,
      },
    ];

    if (cortisolM.numeric != null) {
      monitoringChannels.push({
        id: "cortisol",
        labelIt: "Cortisolo",
        unit: "µg/dL",
        category: "hormonal",
        hourly: cortisolM.provenance === "measured" ? hourlyFlat24(cortisolM.numeric) : [...nomH.cortisolUgdL],
        dataPlane: cortisolM.provenance === "measured" ? "sparse_lab_hold" : "model_continuous",
        replacesWithDeviceStream: true,
        curveResolution: cortisolCurveResolution,
      });
    }
    if (acthM.numeric != null) {
      monitoringChannels.push({
        id: "acth",
        labelIt: "ACTH",
        unit: "pg/mL",
        category: "hormonal",
        hourly: acthM.provenance === "measured" ? hourlyFlat24(acthM.numeric) : [...nomH.acthPgMl],
        dataPlane: acthM.provenance === "measured" ? "sparse_lab_hold" : "model_continuous",
        replacesWithDeviceStream: true,
        curveResolution: acthCurveResolution,
      });
    }
    if (tshM.numeric != null) {
      monitoringChannels.push({
        id: "tsh",
        labelIt: "TSH",
        unit: "mUI/L",
        category: "hormonal",
        hourly: tshM.provenance === "measured" ? hourlyFlat24(tshM.numeric) : [...nomThy.tshMiuL],
        dataPlane: tshM.provenance === "measured" ? "sparse_lab_hold" : "model_continuous",
        replacesWithDeviceStream: true,
        curveResolution: tshCurveResolution,
      });
    }
    if (ft4M.numeric != null) {
      monitoringChannels.push({
        id: "ft4",
        labelIt: "T4 libera / T4",
        unit: "ng/dL",
        category: "hormonal",
        hourly: ft4M.provenance === "measured" ? hourlyFlat24(ft4M.numeric) : [...nomThy.ft4NgDl],
        dataPlane: ft4M.provenance === "measured" ? "sparse_lab_hold" : "model_continuous",
        replacesWithDeviceStream: true,
        curveResolution: ft4CurveResolution,
      });
    }
    if (ghM.numeric != null) {
      monitoringChannels.push({
        id: "gh",
        labelIt: "GH",
        unit: "ng/mL",
        category: "hormonal",
        hourly: ghM.provenance === "measured" ? hourlyFlat24(ghM.numeric) : [...nomGhGre.ghNgMl],
        dataPlane: ghM.provenance === "measured" ? "sparse_lab_hold" : "model_continuous",
        replacesWithDeviceStream: true,
        curveResolution: ghCurveResolution,
      });
    }
    if (ghrelinM.numeric != null) {
      monitoringChannels.push({
        id: "ghrelin",
        labelIt: "Ghrelina",
        unit: "pg/mL",
        category: "gastro_intestinal",
        hourly: ghrelinM.provenance === "measured" ? hourlyFlat24(ghrelinM.numeric) : [...nomGhGre.ghrelinPgMl],
        dataPlane: ghrelinM.provenance === "measured" ? "sparse_lab_hold" : "model_continuous",
        replacesWithDeviceStream: true,
        curveResolution: ghrelinCurveResolution,
      });
    }
    if (igfM.numeric != null) {
      monitoringChannels.push({
        id: "igf1",
        labelIt: "IGF-1",
        unit: "ng/mL",
        category: "hormonal",
        hourly: igfM.provenance === "measured" ? hourlyFlat24(igfM.numeric) : [...nomIgfLep.igf1NgMl],
        dataPlane: igfM.provenance === "measured" ? "sparse_lab_hold" : "model_continuous",
        replacesWithDeviceStream: true,
        curveResolution: igf1CurveResolution,
      });
    }
    if (leptinM.numeric != null) {
      monitoringChannels.push({
        id: "leptin",
        labelIt: "Leptina",
        unit: "ng/mL",
        category: "gastro_intestinal",
        hourly: leptinM.provenance === "measured" ? hourlyFlat24(leptinM.numeric) : [...nomIgfLep.leptinNgMl],
        dataPlane: leptinM.provenance === "measured" ? "sparse_lab_hold" : "model_continuous",
        replacesWithDeviceStream: true,
        curveResolution: leptinCurveResolution,
      });
    }

    continuousMonitoring = {
      layer: "model_continuous_v1",
      channels: monitoringChannels,
    };
  }

  return { metricTiles: tiles, chart24h, continuousMonitoring };
}
