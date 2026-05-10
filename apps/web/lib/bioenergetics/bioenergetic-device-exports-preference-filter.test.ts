import test from "node:test";
import assert from "node:assert/strict";
import { filterDeviceExportsByAthleteDataSourcePreference } from "./bioenergetic-device-exports-preference-filter";

test("senza preferenze: nessun filtro", () => {
  const rows = [{ provider: "whoop", payload: { whoop_recovery: { score: 80 } } }];
  const out = filterDeviceExportsByAthleteDataSourcePreference(rows as Array<Record<string, unknown>>, {});
  assert.equal(out.length, 1);
});

test("recovery WHOOP + sleep Garmin: riga WHOOP con entrambi resta (recovery match)", () => {
  const rows = [
    {
      provider: "whoop",
      payload: {
        whoop_recovery: { score: 70 },
        whoop_sleep: { start: "2026-05-10T22:00:00Z", end: "2026-05-11T06:00:00Z" },
      },
    },
  ];
  const out = filterDeviceExportsByAthleteDataSourcePreference(rows as Array<Record<string, unknown>>, {
    wellness_recovery: "whoop",
    wellness_sleep: "garmin",
  });
  assert.equal(out.length, 1);
});

test("provider Garmin con recovery_score in sourcePayload: escluso se preferenza WHOOP", () => {
  const rows = [
    {
      provider: "garmin",
      payload: {
        sourcePayload: {
          recovery_score: 58,
        },
      },
    },
  ];
  const out = filterDeviceExportsByAthleteDataSourcePreference(rows as Array<Record<string, unknown>>, {
    wellness_recovery: "whoop",
  });
  assert.equal(out.length, 0);
});
