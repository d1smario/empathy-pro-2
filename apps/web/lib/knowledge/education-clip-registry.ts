import type { EducationClipBindingV1 } from "./education-clip-binding";

/**
 * Curated clips under the creative budget (video on CDN, or licensed embed).
 * Wire UI via `resolveEducationClipBinding(clipId)`; link copy to twin only in read-only mode.
 */
export const EDUCATION_CLIP_REGISTRY: Record<string, EducationClipBindingV1> = {};

export function listRegisteredEducationClipIds(): string[] {
  return Object.keys(EDUCATION_CLIP_REGISTRY);
}

export function resolveEducationClipBinding(clipId: string): EducationClipBindingV1 | null {
  const id = clipId.trim();
  if (!id) return null;
  return EDUCATION_CLIP_REGISTRY[id] ?? null;
}
