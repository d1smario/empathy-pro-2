import test from "node:test";
import assert from "node:assert/strict";
import { analyzePlannedSessionsForFueling } from "./fueling-planned-session-analysis";
import type { Pro2BuilderSessionContract } from "../training/builder/pro2-session-contract";

function baseContract(
  blocks: Pro2BuilderSessionContract["blocks"],
  durationSec: number,
  tss: number,
): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "cycling",
    sessionName: "fueling-test",
    summary: {
      durationSec,
      tss,
      kcal: Math.round(tss * 9.3 * (72 / 70)),
      kj: Math.round(tss * 9.3 * (72 / 70) * 4.184),
      avgPowerW: 180,
    },
    renderProfile: { intensityUnit: "watt", ftpW: 250, hrMax: 190, lengthMode: "time", speedRefKmh: 35 },
    blocks,
  };
}

test("analyzePlannedSessionsForFueling: picchi Z7 brevi aumentano lattato vs solo Z2 (stessa durata)", () => {
  const durMin = 92.5;
  const durationSec = Math.round(durMin * 60);

  const steadyBlocks: Pro2BuilderSessionContract["blocks"] = [
    {
      id: "a",
      label: "endurance",
      kind: "endurance",
      durationMinutes: durMin,
      intensityCue: "Z2",
    },
  ];

  const spikeBlocks: Pro2BuilderSessionContract["blocks"] = [
    {
      id: "e",
      label: "easy",
      kind: "endurance",
      durationMinutes: 90,
      intensityCue: "Z2",
    },
    ...[1, 2, 3, 4, 5].map((i) => ({
      id: `s${i}`,
      label: `sprint ${i}`,
      kind: "endurance",
      durationMinutes: 0.5,
      intensityCue: "Z7" as const,
    })),
  ];

  const steady = analyzePlannedSessionsForFueling({
    sessions: [
      {
        id: "1",
        title: "steady",
        durationMinutesDb: durMin,
        tssTargetDb: 55,
        builderSession: baseContract(steadyBlocks, durationSec, 55),
      },
    ],
    weightKg: 72,
    ftpWatts: 250,
    physiology: null,
    choIngestedGH: 45,
  });

  const spike = analyzePlannedSessionsForFueling({
    sessions: [
      {
        id: "2",
        title: "intervals",
        durationMinutesDb: durMin,
        tssTargetDb: 65,
        builderSession: baseContract(spikeBlocks, durationSec, 65),
      },
    ],
    weightKg: 72,
    ftpWatts: 250,
    physiology: null,
    choIngestedGH: 45,
  });

  assert.equal(steady.length, 1);
  assert.equal(spike.length, 1);
  const ls = steady[0]!.lactateModel.lactateProducedG;
  const lp = spike[0]!.lactateModel.lactateProducedG;
  assert.ok(lp > ls * 1.15, `expected spike lactate (${lp}) > steady (${ls})`);

  const intents = spike[0]!.physiologicalIntent.join(" ");
  assert.match(
    intents,
    /Picchi fino|segmenti Builder/i,
    `expected peak or segment copy, got: ${intents.slice(0, 200)}`,
  );
});
