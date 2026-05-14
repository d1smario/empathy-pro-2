import test from "node:test";
import assert from "node:assert/strict";
import type { MetabolicNodeCoherenceV1 } from "@empathy/domain-bioenergetics";
import { buildSimulatedGluLacDiurnalSubHourly } from "@empathy/domain-bioenergetics";
import { applyTimelineContextToGluLacHourly24, buildBioenergeticDayPresentation, pickGlucoseMmolFromLab } from "@/lib/bioenergetics/day-presentation";

const kernelFixture = {
  modelVersion: 1,
  glucoseHandlingScore: 50,
  insulinDemandScore: 40,
  oxidationDriveScore: 50,
  anabolicSuppressionScore: 20,
  efficiencyBand: "high" as const,
  pathwayState: "supportive" as const,
  keyDrivers: [] as string[],
};

const ghrelinGhBlockedNodes: readonly MetabolicNodeCoherenceV1[] = [
  {
    nodeId: "ghrelin",
    labelIt: "Ghrelina (proxy)",
    observability: "blocked",
    rationaleIt: "Test: diario assente.",
  },
  {
    nodeId: "gh_pulse",
    labelIt: "GH (pulsatile / contesto)",
    observability: "blocked",
    rationaleIt: "Test: ghrelina bloccata.",
  },
];

test("buildBioenergeticDayPresentation emette 24 punti orari e tile strutturati", () => {
  const { chart24h, metricTiles } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: {
      modelVersion: 1,
      glucoseHandlingScore: 50,
      insulinDemandScore: 45,
      oxidationDriveScore: 48,
      anabolicSuppressionScore: 30,
      efficiencyBand: "moderate",
      pathwayState: "mixed",
      keyDrivers: ["test"],
    },
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: {
      glucose: [{ ts: "2026-05-01T12:00:00", value: 5.2, source: "kernel_v1" }],
      lactate: [{ ts: "2026-05-01T12:00:00", value: 1.4, source: "kernel_v1" }],
    },
    timeline: [],
    biomarkerRows: [],
  });
  assert.equal(chart24h.length, 24);
  assert.equal(chart24h[0].hour, 0);
  assert.equal(chart24h[23].hour, 23);
  assert.ok(chart24h.every((p) => "lactateMmol" in p && (p.lactateMmol == null || typeof p.lactateMmol === "number")));
  assert.ok(chart24h[12].lactateMmol != null);
  assert.ok(metricTiles.some((t) => t.id === "glucose"));
  assert.ok(metricTiles.some((t) => t.id === "lactate"));
});

test("buildBioenergeticDayPresentation: sim diurno 5m espone streamTrace su glucosio stimato", () => {
  const simKernel = {
    insulinDemandScore: 45,
    anabolicSuppressionScore: 30,
    glucoseHandlingScore: 50,
    oxidationDriveScore: 48,
    pathwayState: "mixed" as const,
  };
  const sim = buildSimulatedGluLacDiurnalSubHourly("2026-05-01", simKernel, [], {}, 5);
  const { continuousMonitoring } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: {
      modelVersion: 1,
      glucoseHandlingScore: 50,
      insulinDemandScore: 45,
      oxidationDriveScore: 48,
      anabolicSuppressionScore: 30,
      efficiencyBand: "moderate",
      pathwayState: "mixed",
      keyDrivers: ["test"],
    },
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: { glucose: sim.glucose, lactate: sim.lactate, insulinProxyDense: sim.insulinProxy },
    timeline: [],
    biomarkerRows: [],
  });
  const glu = continuousMonitoring.channels.find((c) => c.id === "glucose");
  assert.ok(glu?.streamTrace && glu.streamTrace.length === 288);
  assert.equal(glu?.dataPlane, "model_continuous");
  const lac = continuousMonitoring.channels.find((c) => c.id === "lactate");
  assert.ok(lac?.streamTrace && lac.streamTrace.length === 288);
  assert.equal(lac?.dataPlane, "model_continuous");
  const ins = continuousMonitoring.channels.find((c) => c.id === "insulin_proxy");
  assert.ok(ins?.streamTrace && ins.streamTrace.length === 288);
  assert.equal(ins?.dataPlane, "model_continuous");
});

test("buildBioenergeticDayPresentation: stream glucosio denso espone streamTrace per grafico tempo reale", () => {
  const glucosePts = Array.from({ length: 12 }, (_, i) => {
    const h = 6 + Math.floor(i / 2);
    const m = (i % 2) * 30;
    return {
      ts: `2026-05-01T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`,
      value: 5.1 + i * 0.04,
      source: "athlete_time_series_samples",
    };
  });
  const { continuousMonitoring } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: {
      modelVersion: 1,
      glucoseHandlingScore: 50,
      insulinDemandScore: 45,
      oxidationDriveScore: 48,
      anabolicSuppressionScore: 30,
      efficiencyBand: "moderate",
      pathwayState: "mixed",
      keyDrivers: ["test"],
    },
    provenance: { glucose: "measured", lactate: "estimated" },
    channels: {
      glucose: glucosePts,
      lactate: [{ ts: "2026-05-01T12:00:00", value: 1.4, source: "sim_diurnal_v1" }],
    },
    timeline: [],
    biomarkerRows: [],
  });
  const glu = continuousMonitoring.channels.find((c) => c.id === "glucose");
  assert.ok(glu?.streamTrace && glu.streamTrace.length === 12);
  assert.equal(glu?.dataPlane, "measured_stream");
});

test("buildBioenergeticDayPresentation espone continuousMonitoring essenziale (glu lac insulin + ormoni strip)", () => {
  const { continuousMonitoring } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: {
      modelVersion: 1,
      glucoseHandlingScore: 50,
      insulinDemandScore: 45,
      oxidationDriveScore: 48,
      anabolicSuppressionScore: 30,
      efficiencyBand: "moderate",
      pathwayState: "mixed",
      keyDrivers: ["test"],
    },
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: {
      glucose: [{ ts: "2026-05-01T12:00:00", value: 5.2, source: "sim_diurnal_v1" }],
      lactate: [{ ts: "2026-05-01T12:00:00", value: 1.4, source: "sim_diurnal_v1" }],
    },
    timeline: [],
    biomarkerRows: [],
  });
  assert.equal(continuousMonitoring.layer, "model_continuous_v1");
  const ids = continuousMonitoring.channels.map((c) => c.id);
  assert.ok(ids.includes("glucose") && ids.includes("lactate") && ids.includes("insulin_proxy"));
  assert.ok(ids.includes("cortisol") && ids.includes("acth"));
  assert.ok(ids.includes("tsh") && ids.includes("ft4"));
  assert.ok(ids.includes("gh") && ids.includes("ghrelin"));
  assert.ok(ids.includes("igf1") && ids.includes("leptin"));
  assert.equal(continuousMonitoring.channels.length, 11);
});

test("buildBioenergeticDayPresentation: insulin proxy orario sale dopo pasto in timeline", () => {
  const { continuousMonitoring } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: {
      modelVersion: 1,
      glucoseHandlingScore: 50,
      insulinDemandScore: 35,
      oxidationDriveScore: 40,
      anabolicSuppressionScore: 20,
      efficiencyBand: "moderate",
      pathwayState: "mixed",
      keyDrivers: [],
    },
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: {
      glucose: [{ ts: "2026-05-01T12:00:00", value: 5.2, source: "sim_diurnal_v1" }],
      lactate: [{ ts: "2026-05-01T12:00:00", value: 1.2, source: "sim_diurnal_v1" }],
    },
    timeline: [
      {
        id: "m1",
        ts: "2026-05-01T12:30:00",
        type: "meal",
        title: "Pranzo",
        payload: { carbsG: 90, insulinLoad: 28 },
      },
    ],
    biomarkerRows: [],
  });
  const ins = continuousMonitoring.channels.find((c) => c.id === "insulin_proxy");
  assert.ok(ins);
  const h = ins!.hourly.map((x) => (x == null ? NaN : x)) as number[];
  const maxH = Math.max(...h);
  const minH = Math.min(...h);
  assert.ok(maxH - minH > 3, "variazione oraria con pasto e circadiano");
});

test("pickGlucoseMmolFromLab converte glicemia mg/dL da ontology", () => {
  const mmol = pickGlucoseMmolFromLab({ glicemia: 90 });
  assert.ok(mmol != null && mmol > 4.9 && mmol < 5.05);
});

test("buildBioenergeticDayPresentation usa lab se canale glucosio stimato", () => {
  const { metricTiles } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: {
      modelVersion: 1,
      glucoseHandlingScore: 50,
      insulinDemandScore: 50,
      oxidationDriveScore: 40,
      anabolicSuppressionScore: 20,
      efficiencyBand: "moderate",
      pathwayState: "mixed",
      keyDrivers: [],
    },
    provenance: { glucose: "estimated", lactate: "absent" },
    channels: {
      glucose: [{ ts: "2026-05-01T12:00:00", value: 5.5, source: "kernel_v1" }],
      lactate: null,
    },
    timeline: [],
    biomarkerRows: [{ id: "p1", sample_date: "2026-05-01", values: { glicemia: 99 } }],
  });
  const g = metricTiles.find((t) => t.id === "glucose");
  assert.equal(g?.provenance, "measured");
  assert.ok(Number(g?.displayValue) < 6);
});

test("buildBioenergeticDayPresentation usa tile PCR simulata se panel assente", () => {
  const { metricTiles } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: {
      modelVersion: 1,
      glucoseHandlingScore: 50,
      insulinDemandScore: 40,
      oxidationDriveScore: 50,
      anabolicSuppressionScore: 20,
      efficiencyBand: "high",
      pathwayState: "supportive",
      keyDrivers: [],
    },
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: {
      glucose: [{ ts: "2026-05-01T12:00:00", value: 5.2, source: "sim_diurnal_v1" }],
      lactate: [{ ts: "2026-05-01T12:00:00", value: 1.4, source: "sim_diurnal_v1" }],
    },
    timeline: [],
    biomarkerRows: [],
  });
  const crp = metricTiles.find((t) => t.id === "crp");
  assert.equal(crp?.provenance, "estimated");
  assert.notEqual(crp?.displayValue, "—");
});

test("buildBioenergeticDayPresentation: ghrelina/GH senza lab e skeleton blocked → tile absent (no sim finto)", () => {
  const { metricTiles } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: kernelFixture,
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: {
      glucose: [{ ts: "2026-05-01T12:00:00", value: 5.2, source: "sim_diurnal_v1" }],
      lactate: [{ ts: "2026-05-01T12:00:00", value: 1.4, source: "sim_diurnal_v1" }],
    },
    timeline: [],
    biomarkerRows: [],
    interactionNodes: ghrelinGhBlockedNodes,
  });
  const ghrelin = metricTiles.find((t) => t.id === "ghrelin");
  const gh = metricTiles.find((t) => t.id === "gh");
  assert.equal(ghrelin?.provenance, "absent");
  assert.equal(ghrelin?.displayValue, "—");
  assert.equal(gh?.provenance, "absent");
  assert.equal(gh?.displayValue, "—");
});

test("buildBioenergeticDayPresentation: ghrelina partial scala sim rispetto a nodo assente (coeff dominio v1)", () => {
  const baseInput = {
    date: "2026-05-01",
    kernel: kernelFixture,
    provenance: { glucose: "estimated", lactate: "estimated" } as const,
    channels: {
      glucose: [{ ts: "2026-05-01T12:00:00", value: 5.2, source: "sim_diurnal_v1" }],
      lactate: [{ ts: "2026-05-01T12:00:00", value: 1.4, source: "sim_diurnal_v1" }],
    },
    timeline: [],
    biomarkerRows: [] as { id: string; sample_date?: string; values?: Record<string, unknown> }[],
  };
  const full = buildBioenergeticDayPresentation(baseInput);
  const partial = buildBioenergeticDayPresentation({
    ...baseInput,
    interactionNodes: [
      {
        nodeId: "ghrelin",
        labelIt: "Ghrelina (proxy)",
        observability: "partial",
        rationaleIt: "Test: contesto debole.",
      },
    ],
  });
  const f = full.metricTiles.find((t) => t.id === "ghrelin");
  const p = partial.metricTiles.find((t) => t.id === "ghrelin");
  assert.equal(p?.provenance, "estimated");
  assert.ok(f?.numericValue != null && p?.numericValue != null);
  assert.ok(p!.numericValue! < f!.numericValue!);
  assert.ok(Math.abs(p!.numericValue! - f!.numericValue! * 0.82) < 0.02);
});

test("buildBioenergeticDayPresentation: leptina tile absent se leptin_energy_balance skeleton blocked", () => {
  const { metricTiles } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: kernelFixture,
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: {
      glucose: [{ ts: "2026-05-01T12:00:00", value: 5.2, source: "sim_diurnal_v1" }],
      lactate: [{ ts: "2026-05-01T12:00:00", value: 1.4, source: "sim_diurnal_v1" }],
    },
    timeline: [],
    biomarkerRows: [],
    interactionNodes: [
      {
        nodeId: "leptin_energy_balance",
        labelIt: "Leptina / energia (proxy)",
        observability: "blocked",
        rationaleIt: "Test: nessun segnale energetico.",
      },
    ],
  });
  const lep = metricTiles.find((t) => t.id === "leptin");
  assert.equal(lep?.provenance, "absent");
  assert.equal(lep?.displayValue, "—");
});

test("buildBioenergeticDayPresentation: insulin_lab blocked senza panel → absent", () => {
  const { metricTiles } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: kernelFixture,
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: {
      glucose: [{ ts: "2026-05-01T12:00:00", value: 5.2, source: "sim_diurnal_v1" }],
      lactate: [{ ts: "2026-05-01T12:00:00", value: 1.4, source: "sim_diurnal_v1" }],
    },
    timeline: [],
    biomarkerRows: [],
    interactionNodes: [
      {
        nodeId: "insulin_demand",
        labelIt: "Domanda insulinica (proxy)",
        observability: "blocked",
        rationaleIt: "Test: nessun pasto.",
      },
    ],
  });
  const ins = metricTiles.find((t) => t.id === "insulin_lab");
  assert.equal(ins?.provenance, "absent");
  assert.equal(ins?.displayValue, "—");
});

test("buildBioenergeticDayPresentation: lab ghrelina presente resta measured anche con skeleton blocked", () => {
  const { metricTiles } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: kernelFixture,
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: {
      glucose: [{ ts: "2026-05-01T12:00:00", value: 5.2, source: "sim_diurnal_v1" }],
      lactate: [{ ts: "2026-05-01T12:00:00", value: 1.4, source: "sim_diurnal_v1" }],
    },
    timeline: [],
    biomarkerRows: [{ id: "p1", sample_date: "2026-05-01", values: { ghrelin: 120 } }],
    interactionNodes: ghrelinGhBlockedNodes,
  });
  const ghrelin = metricTiles.find((t) => t.id === "ghrelin");
  assert.equal(ghrelin?.provenance, "measured");
  assert.notEqual(ghrelin?.displayValue, "—");
});

test("buildBioenergeticDayPresentation legge valori da panel values fusi", () => {
  const { metricTiles } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: {
      modelVersion: 1,
      glucoseHandlingScore: 50,
      insulinDemandScore: 40,
      oxidationDriveScore: 50,
      anabolicSuppressionScore: 20,
      efficiencyBand: "high",
      pathwayState: "supportive",
      keyDrivers: [],
    },
    provenance: { glucose: "measured", lactate: "absent" },
    channels: { glucose: null, lactate: null },
    timeline: [],
    biomarkerRows: [{ id: "1", values: { tsh: 2.1, testosterone: 520 } }],
  });
  const tsh = metricTiles.find((t) => t.id === "tsh");
  const te = metricTiles.find((t) => t.id === "testosterone");
  assert.notEqual(tsh?.displayValue, "—");
  assert.notEqual(te?.displayValue, "—");
});

test("applyTimelineContextToGluLacHourly24: pasto aumenta glucosio nelle ore pesate", () => {
  const flat = Array.from({ length: 24 }, () => 5.0);
  const mealW = Array.from({ length: 24 }, () => 0);
  mealW[12] = 1.1;
  mealW[13] = 0.4;
  const { glucose } = applyTimelineContextToGluLacHourly24({
    glucose: flat,
    lactate: flat.map(() => 1.2),
    mealW,
    activityH: new Set(),
    glucoseDenseStream: false,
    lactateDenseStream: false,
    insulinDemandScore: 40,
    oxidationDriveScore: 50,
  });
  assert.ok((glucose[12] ?? 0) > 5.25, "bump post-prandiale su glucosio");
  assert.ok((glucose[8] ?? 0) >= 4.99 && (glucose[8] ?? 0) <= 5.01, "ore senza pasto inalterate");
});

test("buildBioenergeticDayPresentation: glucosio e lattato in chart24h rispondono a pasto e seduta in timeline", () => {
  const { chart24h } = buildBioenergeticDayPresentation({
    date: "2026-05-01",
    kernel: {
      modelVersion: 1,
      glucoseHandlingScore: 52,
      insulinDemandScore: 42,
      oxidationDriveScore: 55,
      anabolicSuppressionScore: 22,
      efficiencyBand: "moderate",
      pathwayState: "mixed",
      keyDrivers: [],
    },
    provenance: { glucose: "estimated", lactate: "estimated" },
    channels: {
      glucose: [
        { ts: "2026-05-01T08:00:00", value: 5.0, source: "sim" },
        { ts: "2026-05-01T20:00:00", value: 5.0, source: "sim" },
      ],
      lactate: [
        { ts: "2026-05-01T08:00:00", value: 1.2, source: "sim" },
        { ts: "2026-05-01T20:00:00", value: 1.2, source: "sim" },
      ],
    },
    timeline: [
      {
        id: "m1",
        ts: "2026-05-01T12:15:00",
        type: "meal",
        title: "Pranzo",
        payload: { carbsG: 85, kcal: 720 },
      },
      {
        id: "s1",
        ts: "2026-05-01T15:00:00",
        type: "executed_session",
        title: "Bike",
        payload: { durationMinutes: 75 },
      },
    ],
    biomarkerRows: [],
  });
  const g12 = chart24h[12]?.glucoseMmol;
  const g5 = chart24h[5]?.glucoseMmol;
  assert.ok(g12 != null && g5 != null && g12 > g5 + 0.08, "glicemia a pranzo sopra baseline pomeriggio pre-seduta");
  const lac15 = chart24h[15]?.lactateMmol;
  const lac5 = chart24h[5]?.lactateMmol;
  assert.ok(lac15 != null && lac5 != null && lac15 > lac5 + 0.05, "lattato durante finestra allenamento sopra baseline");
});
