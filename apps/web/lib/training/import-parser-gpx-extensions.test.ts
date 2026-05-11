import assert from "node:assert/strict";
import test from "node:test";

import { mergeTraceChannelAvailability } from "@/lib/training/calendar-analyzer-helpers";
import { parseTrainingFile } from "@/lib/training/import-parser";

const gpxNs3Hr = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk><name>Ride</name><trkseg>
    <trkpt lat="45.0" lon="9.0"><time>2026-05-11T10:00:00Z</time><extensions><ns3:hr>120</ns3:hr></extensions></trkpt>
    <trkpt lat="45.001" lon="9.001"><time>2026-05-11T10:01:00Z</time><extensions><ns3:hr>125</ns3:hr></extensions></trkpt>
  </trkseg></trk>
</gpx>`;

test("parseGpx: HR inside trkpt extensions with arbitrary prefix (ns3:hr)", async () => {
  const parsed = await parseTrainingFile({
    fileName: "ride.gpx",
    mimeType: "application/gpx+xml",
    buffer: Buffer.from(gpxNs3Hr, "utf8"),
  });
  assert.equal(parsed.format, "gpx");
  const ts = parsed.traceSummary as Record<string, unknown>;
  assert.ok((ts.channels_available as Record<string, boolean>).hr, "channels_available.hr");
  assert.ok(typeof ts.hr_avg_bpm === "number" && (ts.hr_avg_bpm as number) > 0, "hr_avg_bpm");
  assert.ok(Array.isArray(ts.hr_series_bpm) && (ts.hr_series_bpm as number[]).length >= 1, "hr_series_bpm");
});

test("mergeTraceChannelAvailability: infer hr from hr_avg when channels_available stale", () => {
  const merged = mergeTraceChannelAvailability({
    channels_available: { hr: false, power: false, speed: true, cadence: false, altitude: true, temperature: false },
    hr_avg_bpm: 118,
    speed_avg_kmh: 22,
  });
  assert.ok(merged?.hr);
  assert.ok(merged?.speed);
});
