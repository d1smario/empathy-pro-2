import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ATL_TAU_DAYS,
  DEFAULT_CTL_TAU_DAYS,
  ewmaDailyStep,
  ewmaRetentionFromTauDays,
} from "./daily-load-ewma";

test("ewmaRetentionFromTauDays(7) matches historic web constant Math.exp(-1/7)", () => {
  assert.equal(ewmaRetentionFromTauDays(7), Math.exp(-1 / 7));
});

test("ewmaRetentionFromTauDays(42) matches historic web constant Math.exp(-1/42)", () => {
  assert.equal(ewmaRetentionFromTauDays(42), Math.exp(-1 / 42));
});

test("single impulse 100 atl then rest decay (tau=7)", () => {
  const tau = DEFAULT_ATL_TAU_DAYS;
  const k = ewmaRetentionFromTauDays(tau);
  let s = ewmaDailyStep(0, 100, tau);
  assert.ok(Math.abs(s - 100 * (1 - k)) < 1e-9);
  s = ewmaDailyStep(s, 0, tau);
  assert.ok(Math.abs(s - 100 * (1 - k) * k) < 1e-9);
});

test("atl (short tau) reacts faster than ctl (long tau) for same impulse from zero", () => {
  const impulse = 50;
  const atl1 = ewmaDailyStep(0, impulse, DEFAULT_ATL_TAU_DAYS);
  const ctl1 = ewmaDailyStep(0, impulse, DEFAULT_CTL_TAU_DAYS);
  assert.ok(atl1 > ctl1);
});

test("tau invalid throws", () => {
  assert.throws(() => ewmaRetentionFromTauDays(0), RangeError);
  assert.throws(() => ewmaRetentionFromTauDays(-1), RangeError);
});
