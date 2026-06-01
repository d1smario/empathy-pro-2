import assert from "node:assert/strict";
import test from "node:test";
import { resolvePostLoginDestination } from "./post-login-destination";
import { ACCESS_PLAN_PATH } from "@/lib/billing/paywall-config";

test("resolvePostLoginDestination: coach sempre /athletes", () => {
  assert.equal(
    resolvePostLoginDestination({
      next: "/dashboard",
      appRole: "coach",
      hasAthleteAccess: false,
      hasOperatorAccess: true,
    }),
    "/athletes",
  );
});

test("resolvePostLoginDestination: atleta senza accesso → piano", () => {
  assert.equal(
    resolvePostLoginDestination({
      next: "/dashboard",
      appRole: "private",
      hasAthleteAccess: false,
      hasOperatorAccess: false,
    }),
    ACCESS_PLAN_PATH,
  );
});

test("resolvePostLoginDestination: atleta con accesso da /access/plan → dashboard", () => {
  assert.equal(
    resolvePostLoginDestination({
      next: ACCESS_PLAN_PATH,
      appRole: "private",
      hasAthleteAccess: true,
      hasOperatorAccess: false,
    }),
    "/dashboard",
  );
});

test("resolvePostLoginDestination: atleta con accesso ignora deep link training instabile", () => {
  assert.equal(
    resolvePostLoginDestination({
      next: "/training/calendar",
      appRole: "private",
      hasAthleteAccess: true,
      hasOperatorAccess: false,
    }),
    "/dashboard",
  );
});

test("resolvePostLoginDestination: atleta con accesso mantiene hub sicuri", () => {
  assert.equal(
    resolvePostLoginDestination({
      next: "/profile",
      appRole: "private",
      hasAthleteAccess: true,
      hasOperatorAccess: false,
    }),
    "/profile",
  );
});

test("resolvePostLoginDestination: preferMobile mappa hub su /m/*", () => {
  assert.equal(
    resolvePostLoginDestination({
      next: "/dashboard",
      appRole: "private",
      hasAthleteAccess: true,
      hasOperatorAccess: false,
      preferMobile: true,
    }),
    "/m/dashboard",
  );
  assert.equal(
    resolvePostLoginDestination({
      next: "/profile",
      appRole: "private",
      hasAthleteAccess: true,
      hasOperatorAccess: false,
      preferMobile: true,
    }),
    "/m/profile",
  );
});
