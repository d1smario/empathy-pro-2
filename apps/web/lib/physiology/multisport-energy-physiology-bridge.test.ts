import test from "node:test";
import assert from "node:assert/strict";
import { buildPhysiologyPayloadsFromMultisport } from "./multisport-energy-physiology-bridge";

test("buildPhysiologyPayloadsFromMultisport: chiavi canoniche metabolic + lactate payloads (cycling golden)", () => {
  const input = {
    sport: "cycling" as const,
    bodyMassKg: 72,
    durationSec: 3600,
    powerW: 200,
    ftpWatts: 250,
    efficiency: 0.24,
    heartRateBpm: 145,
    restingHrBpm: 48,
    maxHrBpm: 188,
  };

  const out = buildPhysiologyPayloadsFromMultisport(input);

  assert.equal(typeof out.engine.pFinalW, "number");
  assert.ok(out.engine.pFinalW > 0);
  assert.equal(out.metabolicProfileOutputPayload.empathy_multisport, true);
  assert.equal(out.metabolicProfileOutputPayload.empathy_multisport_sport, "cycling");
  assert.ok(typeof out.metabolicProfileOutputPayload.vo2_session_ml_kg_min === "number");
  assert.ok(typeof out.lactateOutputPayload === "object");
  assert.match(String(out.lactateInputPayload.source ?? ""), /empathy_multisport/);
});
