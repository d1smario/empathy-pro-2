import type {
  BioenergeticChannelProvenance,
  BioenergeticDayKernelOutput,
  BioenergeticPathwayImpact,
  BioenergeticSeriesPoint,
  BioenergeticTimelineEvent,
  BioenergeticMetricTile,
  BioenergeticHour24Point,
} from "@/api/bioenergetics/contracts";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function hourFromIsoTs(ts: string): number | null {
  const m = ts.match(/T(\d{2}):/);
  if (!m) return null;
  const h = Number(m[1]);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : null;
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

function interpolateGlucoseByHour(
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

function mealInhibitoryHours(timeline: BioenergeticTimelineEvent[]): Set<number> {
  const s = new Set<number>();
  for (const ev of timeline) {
    if (ev.type !== "meal") continue;
    const carbs = (ev.payload?.carbsG as number | undefined) ?? 0;
    if (typeof carbs !== "number" || carbs < 35) continue;
    const h = hourFromIsoTs(ev.ts);
    if (h == null) continue;
    s.add(h);
    s.add((h + 1) % 24);
  }
  return s;
}

function activitySupportHours(timeline: BioenergeticTimelineEvent[]): Set<number> {
  const s = new Set<number>();
  for (const ev of timeline) {
    if (ev.type !== "executed_session" && ev.type !== "planned_session") continue;
    const h = hourFromIsoTs(ev.ts);
    if (h == null) continue;
    for (let d = -1; d <= 2; d += 1) s.add((h + d + 24) % 24);
  }
  return s;
}

export function buildBioenergeticDayPresentation(input: {
  date: string;
  kernel: BioenergeticDayKernelOutput;
  provenance: { glucose: BioenergeticChannelProvenance; lactate: BioenergeticChannelProvenance };
  channels: { glucose: BioenergeticSeriesPoint[] | null; lactate: BioenergeticSeriesPoint[] | null };
  timeline: BioenergeticTimelineEvent[];
  biomarkerRows: Array<Record<string, unknown>>;
}): { metricTiles: BioenergeticMetricTile[]; chart24h: BioenergeticHour24Point[] } {
  const lab = mergeLabValues(input.biomarkerRows);
  const k = input.kernel;
  const baseBalance = clamp(k.oxidationDriveScore - k.insulinDemandScore, -55, 55);
  const mealsHeavy = mealInhibitoryHours(input.timeline);
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

  const glucoseHourly = interpolateGlucoseByHour(
    input.date,
    glucosePointsForInterp,
    gLatest ?? (gTileProv === "estimated" ? 5.4 + k.insulinDemandScore * 0.015 : null),
  );

  const chart24h: BioenergeticHour24Point[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const circ = 12 * Math.sin(((hour - 6) * Math.PI) / 12);
    let bal = baseBalance + circ;
    if (mealsHeavy.has(hour)) bal -= 22;
    if (activityH.has(hour)) bal += 18;
    bal = clamp(bal, -100, 100);
    let impact: BioenergeticPathwayImpact;
    if (bal >= 18) impact = "supportive";
    else if (bal <= -18) impact = "inhibitory";
    else impact = "neutral";
    const g = glucoseHourly[hour];
    chart24h.push({
      hour,
      hourLabel: `${String(hour).padStart(2, "0")}:00`,
      pathwayBalance: Math.round(bal * 10) / 10,
      pathwayImpact: impact,
      glucoseMmol: g,
    });
  }

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

  const crp = pickNum(lab, ["crp_mg_l", "crp", "hs_crp", "hscrp"]);
  pushTile({
    id: "crp",
    labelIt: "PCR-us (contesto)",
    unit: "mg/L",
    displayValue: crp != null ? formatNum(crp, 2) : "—",
    numericValue: crp,
    provenance: crp != null ? "measured" : "absent",
    impact: crp != null ? impactFromCrpMgL(crp) : "neutral",
    category: "inflammatory",
  });

  const tTesto = pickNum(lab, ["testosterone", "testosterone_ng_dl", "testosterone_total"]);
  pushTile({
    id: "testosterone",
    labelIt: "Testosterone",
    unit: "ng/dL",
    displayValue: tTesto != null ? formatNum(tTesto, 0) : "—",
    numericValue: tTesto,
    provenance: tTesto != null ? "measured" : "absent",
    impact: tTesto != null ? impactLabPresentModerate(tTesto, 300, 900) : "neutral",
    category: "hormonal",
  });

  const ft = pickNum(lab, ["free_testosterone", "testosterone_free", "testosterone_free_pg_ml"]);
  pushTile({
    id: "free_testosterone",
    labelIt: "Testosterone libero",
    unit: "pg/mL",
    displayValue: ft != null ? formatNum(ft, 1) : "—",
    numericValue: ft,
    provenance: ft != null ? "measured" : "absent",
    impact: ft != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const tsh = pickNum(lab, ["tsh", "tsh_mui_l", "tsh_miu_l"]);
  pushTile({
    id: "tsh",
    labelIt: "TSH",
    unit: "mUI/L",
    displayValue: tsh != null ? formatNum(tsh, 2) : "—",
    numericValue: tsh,
    provenance: tsh != null ? "measured" : "absent",
    impact: tsh != null ? impactLabPresentModerate(tsh, 0.5, 4.0) : "neutral",
    category: "hormonal",
  });

  const ft3 = pickNum(lab, ["ft3", "t3", "free_t3"]);
  pushTile({
    id: "ft3",
    labelIt: "T3 / FT3",
    unit: "pg/mL",
    displayValue: ft3 != null ? formatNum(ft3, 1) : "—",
    numericValue: ft3,
    provenance: ft3 != null ? "measured" : "absent",
    impact: ft3 != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const ft4 = pickNum(lab, ["ft4", "ft4_ng_dl", "free_t4", "t4"]);
  pushTile({
    id: "ft4",
    labelIt: "T4 libera / T4",
    unit: "ng/dL",
    displayValue: ft4 != null ? formatNum(ft4, 2) : "—",
    numericValue: ft4,
    provenance: ft4 != null ? "measured" : "absent",
    impact: ft4 != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const cortisol = pickNum(lab, ["cortisol_am", "cortisol_pm", "cortisol", "cortisol_ug_dl"]);
  pushTile({
    id: "cortisol",
    labelIt: "Cortisolo",
    unit: "µg/dL",
    displayValue: cortisol != null ? formatNum(cortisol, 1) : "—",
    numericValue: cortisol,
    provenance: cortisol != null ? "measured" : "absent",
    impact: cortisol != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const acth = pickNum(lab, ["acth", "acth_pg_ml"]);
  pushTile({
    id: "acth",
    labelIt: "ACTH",
    unit: "pg/mL",
    displayValue: acth != null ? formatNum(acth, 1) : "—",
    numericValue: acth,
    provenance: acth != null ? "measured" : "absent",
    impact: acth != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const gh = pickNum(lab, ["gh", "growth_hormone", "hgh"]);
  pushTile({
    id: "gh",
    labelIt: "GH",
    unit: "ng/mL",
    displayValue: gh != null ? formatNum(gh, 2) : "—",
    numericValue: gh,
    provenance: gh != null ? "measured" : "absent",
    impact: gh != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const igf = pickNum(lab, ["igf1", "igf_1", "igf1_ng_ml"]);
  pushTile({
    id: "igf1",
    labelIt: "IGF-1",
    unit: "ng/mL",
    displayValue: igf != null ? formatNum(igf, 0) : "—",
    numericValue: igf,
    provenance: igf != null ? "measured" : "absent",
    impact: igf != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const dhea = pickNum(lab, ["dhea_s", "dhea", "dhea_ug_dl"]);
  pushTile({
    id: "dhea",
    labelIt: "DHEA-S / DHEA",
    unit: "µg/dL",
    displayValue: dhea != null ? formatNum(dhea, 0) : "—",
    numericValue: dhea,
    provenance: dhea != null ? "measured" : "absent",
    impact: dhea != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const prog = pickNum(lab, ["progesterone", "progesterone_ng_ml"]);
  pushTile({
    id: "progesterone",
    labelIt: "Progesterone",
    unit: "ng/mL",
    displayValue: prog != null ? formatNum(prog, 2) : "—",
    numericValue: prog,
    provenance: prog != null ? "measured" : "absent",
    impact: prog != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const prol = pickNum(lab, ["prolactin", "prolactin_ng_ml"]);
  pushTile({
    id: "prolactin",
    labelIt: "Prolattina",
    unit: "ng/mL",
    displayValue: prol != null ? formatNum(prol, 1) : "—",
    numericValue: prol,
    provenance: prol != null ? "measured" : "absent",
    impact: prol != null ? "neutral" : "neutral",
    category: "hormonal",
  });

  const homa = pickNum(lab, ["homa_ir", "homa", "homa_index"]);
  pushTile({
    id: "homa_ir",
    labelIt: "HOMA-IR",
    unit: "indice",
    displayValue: homa != null ? formatNum(homa, 2) : "—",
    numericValue: homa,
    provenance: homa != null ? "measured" : "absent",
    impact: homa != null ? impactLabPresentModerate(homa, 0.8, 2.2) : "neutral",
    category: "hormonal",
  });

  const insulinLab = pickNum(lab, ["insulin", "insulin_mui_ml", "insulin_uiu_ml", "fasting_insulin"]);
  pushTile({
    id: "insulin_lab",
    labelIt: "Insulina (lab)",
    unit: "µUI/mL",
    displayValue: insulinLab != null ? formatNum(insulinLab, 1) : "—",
    numericValue: insulinLab,
    provenance: insulinLab != null ? "measured" : "absent",
    impact: insulinLab != null ? impactLabPresentModerate(insulinLab, 3, 25) : "neutral",
    category: "hormonal",
  });

  const gaba = pickNum(lab, ["gaba", "gaba_umol_l"]);
  const sero = pickNum(lab, ["serotonin", "serotonina", "5_ht"]);
  const dopa = pickNum(lab, ["dopamine", "dopamina"]);
  pushTile({
    id: "gaba",
    labelIt: "GABA (contesto)",
    unit: "a.u.",
    displayValue: gaba != null ? formatNum(gaba, 2) : "—",
    numericValue: gaba,
    provenance: gaba != null ? "measured" : "absent",
    impact: "neutral",
    category: "neural",
  });
  pushTile({
    id: "serotonin",
    labelIt: "Serotonina",
    unit: "a.u.",
    displayValue: sero != null ? formatNum(sero, 2) : "—",
    numericValue: sero,
    provenance: sero != null ? "measured" : "absent",
    impact: "neutral",
    category: "neural",
  });
  pushTile({
    id: "dopamine",
    labelIt: "Dopamina",
    unit: "a.u.",
    displayValue: dopa != null ? formatNum(dopa, 2) : "—",
    numericValue: dopa,
    provenance: dopa != null ? "measured" : "absent",
    impact: "neutral",
    category: "neural",
  });

  const gastrin = pickNum(lab, ["gastrin", "gastrin_pg_ml"]);
  const ghrelin = pickNum(lab, ["ghrelin", "ghrelin_pg_ml"]);
  const leptin = pickNum(lab, ["leptin", "leptin_ng_ml"]);
  pushTile({
    id: "gastrin",
    labelIt: "Gastrina",
    unit: "pg/mL",
    displayValue: gastrin != null ? formatNum(gastrin, 0) : "—",
    numericValue: gastrin,
    provenance: gastrin != null ? "measured" : "absent",
    impact: "neutral",
    category: "gastro_intestinal",
  });
  pushTile({
    id: "ghrelin",
    labelIt: "Ghrelina",
    unit: "pg/mL",
    displayValue: ghrelin != null ? formatNum(ghrelin, 0) : "—",
    numericValue: ghrelin,
    provenance: ghrelin != null ? "measured" : "absent",
    impact: "neutral",
    category: "gastro_intestinal",
  });
  pushTile({
    id: "leptin",
    labelIt: "Leptina",
    unit: "ng/mL",
    displayValue: leptin != null ? formatNum(leptin, 1) : "—",
    numericValue: leptin,
    provenance: leptin != null ? "measured" : "absent",
    impact: "neutral",
    category: "gastro_intestinal",
  });

  const lh = pickNum(lab, ["lh", "lh_miu_ml"]);
  const fsh = pickNum(lab, ["fsh", "fsh_miu_ml"]);
  const estradiol = pickNum(lab, ["estradiol", "estradiol_pg_ml"]);
  pushTile({
    id: "lh",
    labelIt: "LH",
    unit: "mUI/mL",
    displayValue: lh != null ? formatNum(lh, 1) : "—",
    numericValue: lh,
    provenance: lh != null ? "measured" : "absent",
    impact: "neutral",
    category: "gonadal",
  });
  pushTile({
    id: "fsh",
    labelIt: "FSH",
    unit: "mUI/mL",
    displayValue: fsh != null ? formatNum(fsh, 1) : "—",
    numericValue: fsh,
    provenance: fsh != null ? "measured" : "absent",
    impact: "neutral",
    category: "gonadal",
  });
  pushTile({
    id: "estradiol",
    labelIt: "Estradiolo",
    unit: "pg/mL",
    displayValue: estradiol != null ? formatNum(estradiol, 0) : "—",
    numericValue: estradiol,
    provenance: estradiol != null ? "measured" : "absent",
    impact: "neutral",
    category: "gonadal",
  });

  return { metricTiles: tiles, chart24h };
}
