import test from "node:test";
import assert from "node:assert/strict";
import { workoutArchetypeKeyFromContract } from "./workout-archetype-key";
import type { Pro2BuilderSessionContract } from "@/lib/training/builder/pro2-session-contract";

function contract(label: string): Pro2BuilderSessionContract {
  return {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: "Bike",
    sessionName: label,
    summary: { durationSec: 1800, tss: 40, kcal: 200, kj: 800, avgPowerW: 150 },
    renderProfile: { intensityUnit: "watt", ftpW: 200, hrMax: 180, lengthMode: "time", speedRefKmh: 30 },
    blocks: [
      {
        id: "1",
        label,
        kind: "steady",
        durationMinutes: 30,
        intensityCue: "Z2",
      },
    ],
  };
}

test("workoutArchetypeKeyFromContract: stable for same shape", () => {
  const a = workoutArchetypeKeyFromContract(contract("Endurance"));
  const b = workoutArchetypeKeyFromContract(contract("Endurance"));
  assert.equal(a, b);
  assert.equal(a.length, 32);
});

test("workoutArchetypeKeyFromContract: differs when block label changes", () => {
  const a = workoutArchetypeKeyFromContract(contract("A"));
  const b = workoutArchetypeKeyFromContract(contract("B"));
  assert.notEqual(a, b);
});
