import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCESS_POST_SIGNUP_PLAN_PATH,
  postOtpEmailRedirectNext,
  postSignInRedirectPath,
  postSignupRegistrationPath,
} from "./post-registration-redirects";

test("postSignupRegistrationPath: coach vs private", () => {
  assert.equal(postSignupRegistrationPath("coach"), "/athletes");
  assert.equal(postSignupRegistrationPath("private"), ACCESS_POST_SIGNUP_PLAN_PATH);
});

test("postSignInRedirectPath: coach forced; private keeps next", () => {
  assert.equal(postSignInRedirectPath("/dashboard", "coach"), "/athletes");
  assert.equal(postSignInRedirectPath("/training/foo", "private"), "/training/foo");
});

test("postOtpEmailRedirectNext: coach → athletes", () => {
  assert.equal(postOtpEmailRedirectNext("/dashboard", "coach"), "/athletes");
});

test("postOtpEmailRedirectNext: private default → plan", () => {
  assert.equal(postOtpEmailRedirectNext("/dashboard", "private"), ACCESS_POST_SIGNUP_PLAN_PATH);
  assert.equal(postOtpEmailRedirectNext("/", "private"), ACCESS_POST_SIGNUP_PLAN_PATH);
});

test("postOtpEmailRedirectNext: private explicit next preserved", () => {
  assert.equal(postOtpEmailRedirectNext("/nutrition", "private"), "/nutrition");
});
