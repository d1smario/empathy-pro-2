import { describe, expect, test } from "vitest";
import {
  buildScalarRepresentativeHrSeriesBpm,
  resolveGarminActivitySessionTimes,
  resolveWhoopWorkoutSessionTimes,
} from "@/lib/training/executed/executed-workout-session-times";

describe("resolveWhoopWorkoutSessionTimes", () => {
  test("usa start/end WHOOP", () => {
    const t = resolveWhoopWorkoutSessionTimes(
      {
        start: "2026-05-16T14:30:00.000Z",
        end: "2026-05-16T16:26:00.000Z",
      },
      116,
    );
    expect(t?.started_at).toBe("2026-05-16T14:30:00.000Z");
    expect(t?.ended_at).toBe("2026-05-16T16:26:00.000Z");
  });

  test("deriva end da durata se end assente", () => {
    const t = resolveWhoopWorkoutSessionTimes({ start: "2026-05-16T14:30:00.000Z" }, 60);
    expect(t?.started_at).toBe("2026-05-16T14:30:00.000Z");
    expect(t?.ended_at).toBe("2026-05-16T15:30:00.000Z");
  });
});

describe("resolveGarminActivitySessionTimes", () => {
  test("da startTimeInSeconds + durationInSeconds", () => {
    const startSec = Math.floor(new Date("2026-05-16T06:00:00.000Z").getTime() / 1000);
    const t = resolveGarminActivitySessionTimes({
      startTimeInSeconds: startSec,
      durationInSeconds: 6960,
    });
    expect(t?.started_at).toBe("2026-05-16T06:00:00.000Z");
    expect(t?.ended_at).toBe("2026-05-16T07:56:00.000Z");
  });
});

describe("buildScalarRepresentativeHrSeriesBpm", () => {
  test("produce almeno 2 campioni", () => {
    const s = buildScalarRepresentativeHrSeriesBpm({ durationMinutes: 90, avgBpm: 142, maxBpm: 168 });
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s[0]).toBe(142);
    expect(s.some((v) => v === 168)).toBe(true);
  });
});
