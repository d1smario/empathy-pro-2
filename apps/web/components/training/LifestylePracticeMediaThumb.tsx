"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { imageSrcUnoptimized } from "@/lib/media/image-src-unoptimized";
import {
  LIFESTYLE_V1_DEFAULT_IMAGE,
  lifestyleV1FallbackImageForCategory,
} from "@/lib/training/builder/lifestyle-media";
import type { LifestylePracticeCategory } from "@/lib/training/builder/lifestyle-playbook-catalog";

export type LifestylePracticeMediaThumbProps = {
  /** URL custom (es. galleria Spline futura); se vuoto si usa il fallback V1 per categoria. */
  src?: string | null;
  practiceCategory: LifestylePracticeCategory;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  /** Chiave stabile playbook; riservata a integrazione Spline / galleria. */
  playbookItemId?: string | null;
};

/**
 * Anteprima pratica lifestyle: PNG/WebP custom, altrimenti SVG master V1 (stesso percorso public di Vyria V1).
 */
export function LifestylePracticeMediaThumb({
  src,
  practiceCategory,
  alt,
  className = "",
  fallbackLabel,
  playbookItemId,
}: LifestylePracticeMediaThumbProps) {
  const v1Fallback = useMemo(() => lifestyleV1FallbackImageForCategory(practiceCategory), [practiceCategory]);

  const primary = (src ?? "").trim() || null;
  const [useV1Fallback, setUseV1Fallback] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setUseV1Fallback(false);
    setBroken(false);
  }, [primary, v1Fallback]);

  const displaySrc = useMemo(() => {
    if (broken) return null;
    if (useV1Fallback) return v1Fallback;
    if (primary) return primary;
    return v1Fallback || LIFESTYLE_V1_DEFAULT_IMAGE;
  }, [primary, v1Fallback, useV1Fallback, broken]);

  const label = fallbackLabel?.trim() || alt || "Pratica";

  if (!displaySrc) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-emerald-950/80 to-teal-950/90 text-center text-[0.65rem] font-semibold leading-tight text-emerald-100/90 ${className}`}
      >
        <span className="line-clamp-4 px-2">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-black/40 ${className}`}
      data-lifestyle-playbook={playbookItemId?.trim() || undefined}
    >
      <Image
        src={displaySrc}
        alt={alt}
        fill
        className="object-cover object-center"
        sizes="(max-width: 768px) 50vw, 160px"
        loading="lazy"
        unoptimized={imageSrcUnoptimized(displaySrc)}
        onError={() => {
          if (primary && !useV1Fallback && displaySrc === primary) {
            setUseV1Fallback(true);
            return;
          }
          setBroken(true);
        }}
      />
    </div>
  );
}
