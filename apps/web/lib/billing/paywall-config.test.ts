import test from "node:test";
import assert from "node:assert/strict";
import { isPaywallEnforced, isPostSignupCheckoutRequired } from "./paywall-config";

test("isPaywallEnforced: default true when env unset", () => {
  const prev = process.env.EMPATHY_PAYWALL_ENFORCED;
  delete process.env.EMPATHY_PAYWALL_ENFORCED;
  assert.equal(isPaywallEnforced(), true);
  process.env.EMPATHY_PAYWALL_ENFORCED = "false";
  assert.equal(isPaywallEnforced(), false);
  if (prev !== undefined) process.env.EMPATHY_PAYWALL_ENFORCED = prev;
  else delete process.env.EMPATHY_PAYWALL_ENFORCED;
});

test("isPostSignupCheckoutRequired: default true when env unset", () => {
  const prev = process.env.EMPATHY_POST_SIGNUP_CHECKOUT_REQUIRED;
  delete process.env.EMPATHY_POST_SIGNUP_CHECKOUT_REQUIRED;
  assert.equal(isPostSignupCheckoutRequired(), true);
  process.env.EMPATHY_POST_SIGNUP_CHECKOUT_REQUIRED = "false";
  assert.equal(isPostSignupCheckoutRequired(), false);
  if (prev !== undefined) process.env.EMPATHY_POST_SIGNUP_CHECKOUT_REQUIRED = prev;
  else delete process.env.EMPATHY_POST_SIGNUP_CHECKOUT_REQUIRED;
});
