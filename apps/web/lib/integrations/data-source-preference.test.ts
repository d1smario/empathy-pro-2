import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_DATA_SOURCE_DOMAINS,
  executedWorkoutSourceMatchesPreference,
  isDataSourceDomain,
  isDataSourceProvider,
  pickPreferredProvider,
  preferredDeviceExportProviders,
  preferredExecutedWorkoutSourcePrefixes,
  type DataSourcePreferenceMap,
} from "./data-source-preference";

test("validators accettano solo domini/provider canonici", () => {
  assert.equal(isDataSourceDomain("wellness_sleep"), true);
  assert.equal(isDataSourceDomain("wellness_recovery"), true);
  assert.equal(isDataSourceDomain("training_activity"), true);
  assert.equal(isDataSourceDomain("nope"), false);
  assert.equal(isDataSourceProvider("whoop"), true);
  assert.equal(isDataSourceProvider("garmin"), true);
  assert.equal(isDataSourceProvider("wahoo"), true);
  assert.equal(isDataSourceProvider("apple_health"), false);
});

test("ALL_DATA_SOURCE_DOMAINS copre i tre domini di prodotto", () => {
  assert.deepEqual(ALL_DATA_SOURCE_DOMAINS, [
    "wellness_sleep",
    "wellness_recovery",
    "training_activity",
  ]);
});

test("pickPreferredProvider torna null se nessuna preferenza salvata (default storico)", () => {
  const map: DataSourcePreferenceMap = {};
  assert.equal(pickPreferredProvider(map, "wellness_sleep"), null);
  assert.equal(pickPreferredProvider(map, "wellness_recovery"), null);
  assert.equal(pickPreferredProvider(map, "training_activity"), null);
});

test("preferredDeviceExportProviders → null = nessun filtro, altrimenti array di provider", () => {
  assert.equal(preferredDeviceExportProviders({}, "wellness_sleep"), null);
  assert.deepEqual(
    preferredDeviceExportProviders({ wellness_sleep: "whoop" }, "wellness_sleep"),
    ["whoop"],
  );
  assert.deepEqual(
    preferredDeviceExportProviders({ wellness_recovery: "garmin" }, "wellness_recovery"),
    ["garmin"],
  );
});

test("preferredExecutedWorkoutSourcePrefixes mappa preferenza training su prefisso `api_sync:<provider>:`", () => {
  assert.equal(preferredExecutedWorkoutSourcePrefixes({}), null);
  assert.deepEqual(
    preferredExecutedWorkoutSourcePrefixes({ training_activity: "garmin" }),
    ["api_sync:garmin:"],
  );
  assert.deepEqual(
    preferredExecutedWorkoutSourcePrefixes({ training_activity: "wahoo" }),
    ["api_sync:wahoo:"],
  );
  assert.deepEqual(
    preferredExecutedWorkoutSourcePrefixes({ training_activity: "manual" }),
    ["manual", "file_import"],
  );
});

test("executedWorkoutSourceMatchesPreference: nessuna pref = sempre vero", () => {
  assert.equal(executedWorkoutSourceMatchesPreference({}, "api_sync:wahoo:workouts"), true);
  assert.equal(executedWorkoutSourceMatchesPreference({}, null), true);
  assert.equal(executedWorkoutSourceMatchesPreference({}, "manual"), true);
});

test("executedWorkoutSourceMatchesPreference filtra coerentemente per provider scelto", () => {
  const pref: DataSourcePreferenceMap = { training_activity: "garmin" };
  assert.equal(executedWorkoutSourceMatchesPreference(pref, "api_sync:garmin:activities"), true);
  assert.equal(executedWorkoutSourceMatchesPreference(pref, "api_sync:garmin:activityDetails"), true);
  assert.equal(executedWorkoutSourceMatchesPreference(pref, "api_sync:wahoo:workouts"), false);
  assert.equal(executedWorkoutSourceMatchesPreference(pref, "manual"), false);
  assert.equal(executedWorkoutSourceMatchesPreference(pref, null), false);
  assert.equal(executedWorkoutSourceMatchesPreference(pref, "file_import"), true);
  assert.equal(executedWorkoutSourceMatchesPreference(pref, "file_import:fit:other"), true);
});

test("preferenza manual lascia passare upload manuali e file_import", () => {
  const pref: DataSourcePreferenceMap = { training_activity: "manual" };
  assert.equal(executedWorkoutSourceMatchesPreference(pref, "manual"), true);
  assert.equal(executedWorkoutSourceMatchesPreference(pref, "file_import"), true);
  assert.equal(executedWorkoutSourceMatchesPreference(pref, "api_sync:garmin:activities"), false);
});
