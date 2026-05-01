import test from "node:test";
import assert from "node:assert/strict";
import { buildLoopClosureHint, type PriorDaySnapshot } from "./expected-vs-obtained-loop-closure";

function day(
  date: string,
  status: string,
  executionPct: number,
  readinessScore: number,
  hint: Record<string, unknown> = {},
) {
  return {
    date,
    status,
    delta: { execution_pct: executionPct },
    readiness: { score: readinessScore },
    adaptationHint: hint,
  };
}

test("buildLoopClosureHint: senza prior", () => {
  const h = buildLoopClosureHint(null, day("2026-05-02", "watch", 90, 55));
  assert.equal(h.compliance_vs_prior, "unknown");
  assert.equal(h.recovery_vs_prior, "unknown");
  assert.match(String(h.summary_it), /Nessun snapshot/);
});

test("buildLoopClosureHint: readiness migliora", () => {
  const prior: PriorDaySnapshot = {
    date: "2026-05-01",
    execution_pct: 88,
    readiness_score: 48,
    status: "watch",
  };
  const h = buildLoopClosureHint(prior, day("2026-05-02", "watch", 90, 55));
  assert.equal(h.recovery_vs_prior, "improved");
  assert.equal(h.compliance_vs_prior, "flat");
  assert.match(String(h.summary_it), /miglioramento/);
});

test("buildLoopClosureHint: execution molto più alta", () => {
  const prior: PriorDaySnapshot = {
    date: "2026-05-01",
    execution_pct: 80,
    readiness_score: 60,
    status: "aligned",
  };
  const h = buildLoopClosureHint(prior, day("2026-05-02", "adapt", 95, 58));
  assert.equal(h.compliance_vs_prior, "higher");
});
