import { projectCourseTimeDelta } from "@empathy/domain-aerodynamics";

export function projectAeroCourseFromSession(input: {
  baselineCdaM2: number;
  optimizedCdaM2: number;
  distanceKm: number;
  avgSpeedKph: number;
}) {
  return projectCourseTimeDelta({
    baselineCdaM2: input.baselineCdaM2,
    optimizedCdaM2: input.optimizedCdaM2,
    course: { distanceKm: input.distanceKm, avgSpeedKph: input.avgSpeedKph },
  });
}
