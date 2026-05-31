import { estimateTimeSavingsSeconds } from "./index";

export type CourseProfileInput = {
  distanceKm: number;
  elevationGainM?: number;
  avgSpeedKph: number;
};

export type CourseAeroProjectionV1 = {
  baselineCdaM2: number;
  optimizedCdaM2: number;
  distanceKm: number;
  avgSpeedKph: number;
  estimatedTimeDeltaSeconds: number;
  estimatedWattSavingsProxy: number;
  algorithmVersion: "course_aero_projection_v1";
};

export function projectCourseTimeDelta(input: {
  baselineCdaM2: number;
  optimizedCdaM2: number;
  course: CourseProfileInput;
}): CourseAeroProjectionV1 {
  const { baselineCdaM2, optimizedCdaM2, course } = input;
  const speedMps = course.avgSpeedKph / 3.6;
  const durationSeconds =
    course.distanceKm > 0 && speedMps > 0 ? (course.distanceKm * 1000) / speedMps : 3600;

  const estimatedTimeDeltaSeconds = estimateTimeSavingsSeconds({
    baselineCdaM2,
    optimizedCdaM2,
    speedKph: course.avgSpeedKph,
    durationSeconds,
  });

  const cdaRatio = baselineCdaM2 > 0 ? optimizedCdaM2 / baselineCdaM2 : 1;
  const estimatedWattSavingsProxy = Math.max(0, (1 - cdaRatio) * 100);

  return {
    baselineCdaM2,
    optimizedCdaM2,
    distanceKm: course.distanceKm,
    avgSpeedKph: course.avgSpeedKph,
    estimatedTimeDeltaSeconds,
    estimatedWattSavingsProxy,
    algorithmVersion: "course_aero_projection_v1",
  };
}
