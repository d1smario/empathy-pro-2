import type { UnifiedExerciseRecord } from "@/lib/training/exercise-library/types";
import { publicUrlForGeneratedExerciseImage } from "@/lib/training/builder/generated-image-manifest";

function safePublicAssetPath(input: string | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

function safeExternalOrPublicUrl(input: string | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (value.startsWith("/")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

/**
 * Priorità (parità V1): manifest PNG statico → asset catalogo → thumb/gif → arte SVG deterministica.
 */
export function resolveExerciseMediaUrl(record: UnifiedExerciseRecord): string {
  const generatedPublic = publicUrlForGeneratedExerciseImage(record.id);
  if (generatedPublic) return generatedPublic;

  const localAsset = safePublicAssetPath(record.media?.localAssetPath);
  if (localAsset) return localAsset;

  const thumbnail = safeExternalOrPublicUrl(record.media?.thumbnailUrl);
  if (thumbnail) return thumbnail;

  const gif = safeExternalOrPublicUrl(record.media?.gifUrl);
  if (gif) return gif;

  return `/api/training/builder/exercise-art?catalogExerciseId=${encodeURIComponent(record.id)}`;
}
