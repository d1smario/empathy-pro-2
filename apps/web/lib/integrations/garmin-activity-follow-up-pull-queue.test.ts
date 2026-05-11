import assert from "node:assert/strict";
import test from "node:test";

import {
  extractGarminPullTokenFromCallbackUrl,
  readUploadWindowFromCallbackUrl,
} from "@/lib/integrations/garmin-activity-follow-up-url";

test("extractGarminPullTokenFromCallbackUrl reads token query", () => {
  const url =
    "https://apis.garmin.com/wellness-api/rest/activities?uploadStartTimeInSeconds=1&uploadEndTimeInSeconds=2&token=abc%2Bdef";
  assert.equal(extractGarminPullTokenFromCallbackUrl(url), "abc+def");
});

test("readUploadWindowFromCallbackUrl parses upload pair", () => {
  const url =
    "https://apis.garmin.com/wellness-api/rest/activities?uploadStartTimeInSeconds=100&uploadEndTimeInSeconds=200&token=t";
  assert.deepEqual(readUploadWindowFromCallbackUrl(url), { start: 100, end: 200 });
});
