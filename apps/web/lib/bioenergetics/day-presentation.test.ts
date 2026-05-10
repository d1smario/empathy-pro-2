import test from "node:test";
import assert from "node:assert/strict";
import type { MetabolicNodeCoherenceV1 } from "@empathy/domain-bioenergetics";
import { buildBioenergeticDayPresentation, pickGlucoseMmolFromLab } from "@/lib/bioenergetics/day-presentation";

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

test("buildBioenergeticDayPresentation espone continuousMonitoring essenziale (glu lac insulin cort acth)", () => {
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
  assert.equal(continuousMonitoring.channels.length, 5);
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
