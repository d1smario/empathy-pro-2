import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveUserAccessEntitlement,
  grantEndsAtFromMonths,
  type UserAccessInputs,
} from "./access-entitlement";

function inputs(over: Partial<UserAccessInputs> = {}): UserAccessInputs {
  return {
    isPlatformAdmin: false,
    role: "private",
    platformCoachStatus: null,
    paidSubscriptions: [],
    activeGrants: [],
    ...over,
  };
}

test("admin: sempre accesso (operator+athlete) anche senza piano", () => {
  const r = resolveUserAccessEntitlement(inputs({ isPlatformAdmin: true }));
  assert.equal(r.source, "admin");
  assert.equal(r.hasOperatorAccess, true);
  assert.equal(r.hasAthleteAccess, true);
  assert.equal(r.validUntil, null);
});

test("private senza nulla: accesso negato", () => {
  const r = resolveUserAccessEntitlement(inputs());
  assert.equal(r.source, "none");
  assert.equal(r.hasAthleteAccess, false);
  assert.equal(r.hasOperatorAccess, false);
});

test("private con Stripe active: accesso atleta concesso", () => {
  const r = resolveUserAccessEntitlement(
    inputs({
      paidSubscriptions: [
        { status: "active", currentPeriodEnd: "2026-12-31T00:00:00Z", basePlanId: "athlete_pro" },
      ],
    }),
  );
  assert.equal(r.source, "stripe_paid");
  assert.equal(r.hasAthleteAccess, true);
  assert.equal(r.hasOperatorAccess, false);
  assert.equal(r.validUntil, "2026-12-31T00:00:00Z");
});

test("private con Stripe trialing: equivalente ad active", () => {
  const r = resolveUserAccessEntitlement(
    inputs({
      paidSubscriptions: [{ status: "trialing", currentPeriodEnd: null, basePlanId: null }],
    }),
  );
  assert.equal(r.source, "stripe_paid");
  assert.equal(r.hasAthleteAccess, true);
});

test("private con sub canceled (status non valido): nessun accesso", () => {
  const r = resolveUserAccessEntitlement(
    inputs({
      paidSubscriptions: [
        { status: "canceled", currentPeriodEnd: "2030-01-01T00:00:00Z", basePlanId: "athlete_pro" },
      ],
    }),
  );
  assert.equal(r.source, "none");
});

test("private con grant testimonial attivo: accesso atleta", () => {
  const r = resolveUserAccessEntitlement(
    inputs({
      activeGrants: [{ kind: "testimonial", endsAt: "2026-08-10T00:00:00Z" }],
    }),
  );
  assert.equal(r.source, "grant_active");
  assert.equal(r.hasAthleteAccess, true);
  assert.equal(r.validUntil, "2026-08-10T00:00:00Z");
  assert.equal(r.label, "Profilo testimonial");
});

test("priorità: paid > grant", () => {
  const r = resolveUserAccessEntitlement(
    inputs({
      paidSubscriptions: [
        { status: "active", currentPeriodEnd: "2027-01-01T00:00:00Z", basePlanId: "athlete_pro" },
      ],
      activeGrants: [{ kind: "testimonial", endsAt: "2026-08-10T00:00:00Z" }],
    }),
  );
  assert.equal(r.source, "stripe_paid");
});

test("coach approved senza paid/grant: operator sì, athlete NO (anti-bypass auto-monitoraggio)", () => {
  const r = resolveUserAccessEntitlement(
    inputs({ role: "coach", platformCoachStatus: "approved" }),
  );
  assert.equal(r.source, "coach_operator");
  assert.equal(r.hasOperatorAccess, true);
  assert.equal(r.hasAthleteAccess, false);
});

test("coach pending senza grant: nessun accesso (no operator, no athlete)", () => {
  const r = resolveUserAccessEntitlement(
    inputs({ role: "coach", platformCoachStatus: "pending" }),
  );
  assert.equal(r.source, "none");
  assert.equal(r.hasOperatorAccess, false);
  assert.equal(r.hasAthleteAccess, false);
});

test("coach approved + grant testimonial: operator sì, athlete sì da grant", () => {
  const r = resolveUserAccessEntitlement(
    inputs({
      role: "coach",
      platformCoachStatus: "approved",
      activeGrants: [{ kind: "testimonial", endsAt: "2026-09-01T00:00:00Z" }],
    }),
  );
  assert.equal(r.source, "grant_active");
  assert.equal(r.hasOperatorAccess, true);
  assert.equal(r.hasAthleteAccess, true);
});

test("coach suspended con paid: athlete sì, operator NO", () => {
  const r = resolveUserAccessEntitlement(
    inputs({
      role: "coach",
      platformCoachStatus: "suspended",
      paidSubscriptions: [
        { status: "active", currentPeriodEnd: "2027-01-01T00:00:00Z", basePlanId: "athlete_pro" },
      ],
    }),
  );
  assert.equal(r.source, "stripe_paid");
  assert.equal(r.hasAthleteAccess, true);
  assert.equal(r.hasOperatorAccess, false);
});

test("grantEndsAtFromMonths: somma N mesi UTC", () => {
  const start = "2026-01-15T10:00:00Z";
  assert.equal(grantEndsAtFromMonths(1, start), "2026-02-15T10:00:00.000Z");
  assert.equal(grantEndsAtFromMonths(3, start), "2026-04-15T10:00:00.000Z");
  assert.equal(grantEndsAtFromMonths(9, start), "2026-10-15T10:00:00.000Z");
});

test("grantEndsAtFromMonths: minimo 1 mese (clamp)", () => {
  const start = "2026-01-15T10:00:00Z";
  assert.equal(grantEndsAtFromMonths(0, start), "2026-02-15T10:00:00.000Z");
  assert.equal(grantEndsAtFromMonths(-3, start), "2026-02-15T10:00:00.000Z");
});
