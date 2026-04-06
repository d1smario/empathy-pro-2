"use client";

import { useEffect, useMemo, useState } from "react";

type GymExerciseMediaThumbProps = {
  src?: string | null;
  alt: string;
  className?: string;
  catalogExerciseId?: string | null;
  fallbackLabel?: string;
};

/**
 * Thumb catalogo/scheda palestra: PNG statico da manifest V1, poi fallback SVG `/api/.../exercise-art`.
 */
export function GymExerciseMediaThumb({
  src,
  alt,
  className = "",
  catalogExerciseId,
  fallbackLabel,
}: GymExerciseMediaThumbProps) {
  const artUrl = useMemo(() => {
    const id = catalogExerciseId?.trim();
    if (!id) return null;
    return `/api/training/builder/exercise-art?catalogExerciseId=${encodeURIComponent(id)}`;
  }, [catalogExerciseId]);

  const primary = (src ?? "").trim() || null;
  const [useArtFallback, setUseArtFallback] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setUseArtFallback(false);
    setBroken(false);
  }, [primary, artUrl]);

  const displaySrc = useMemo(() => {
    if (broken) return null;
    if (useArtFallback && artUrl) return artUrl;
    if (primary) return primary;
    if (artUrl) return artUrl;
    return null;
  }, [primary, artUrl, useArtFallback, broken]);

  const label = fallbackLabel?.trim() || alt || "Esercizio";

  if (!displaySrc) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-orange-950/80 to-black/90 text-center text-[0.65rem] font-semibold leading-tight text-orange-100/90 ${className}`}
      >
        <span className="line-clamp-4 px-2">{label}</span>
      </div>
    );
  }

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={`object-cover ${className}`}
      loading="lazy"
      onError={() => {
        if (artUrl && primary && !useArtFallback && displaySrc === primary) {
          setUseArtFallback(true);
          return;
        }
        setBroken(true);
      }}
    />
  );
}
