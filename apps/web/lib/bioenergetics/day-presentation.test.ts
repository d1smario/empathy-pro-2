import test from "node:test";
import assert from "node:assert/strict";
import { buildBioenergeticDayPresentation, pickGlucoseMmolFromLab } from "@/lib/bioenergetics/day-presentation";

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
