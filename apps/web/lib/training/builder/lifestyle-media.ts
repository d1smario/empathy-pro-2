/**
 * Placeholder visivi lifestyle: stessi master SVG del builder V1 (`public/assets/empathy/exercises/block1/masters/`).
 * Galleria Spline / asset per `playbookItemId` → da collegare in seguito.
 */

import type { LifestylePracticeCategory } from "@/lib/training/builder/lifestyle-playbook-catalog";

const MASTERS_BASE = "/assets/empathy/exercises/block1/masters";

/** Master V1 “core / controllo” — usato come default principale mind-body. */
export const LIFESTYLE_V1_DEFAULT_IMAGE = `${MASTERS_BASE}/core-control.svg`;

const CATEGORY_FALLBACK: Partial<Record<LifestylePracticeCategory, string>> = {
  yoga: `${MASTERS_BASE}/core-control.svg`,
  pilates: `${MASTERS_BASE}/core-control.svg`,
  breath: `${MASTERS_BASE}/core-control.svg`,
  meditation: `${MASTERS_BASE}/core-control.svg`,
  mobility: `${MASTERS_BASE}/sport-specific-skill.svg`,
  stretch: `${MASTERS_BASE}/sport-specific-skill.svg`,
};

export function lifestyleV1FallbackImageForCategory(category: LifestylePracticeCategory): string {
  return CATEGORY_FALLBACK[category] ?? LIFESTYLE_V1_DEFAULT_IMAGE;
}
