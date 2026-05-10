import type { BioenergeticTimelineEvent } from "@/api/bioenergetics/contracts";
import {
  activitySupportHours as activitySupportHoursV1,
  hourFromIsoTs as hourFromIsoTsV1,
  mealInhibitoryHours as mealInhibitoryHoursV1,
} from "@empathy/domain-bioenergetics";

export function hourFromIsoTs(ts: string): number | null {
  return hourFromIsoTsV1(ts);
}

export function mealInhibitoryHours(timeline: BioenergeticTimelineEvent[]): Set<number> {
  return mealInhibitoryHoursV1(timeline);
}

export function activitySupportHours(timeline: BioenergeticTimelineEvent[]): Set<number> {
  return activitySupportHoursV1(timeline);
}
