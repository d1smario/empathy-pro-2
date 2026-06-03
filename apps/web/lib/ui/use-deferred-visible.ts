"use client";

import { useEffect, useRef, useState } from "react";

/** Attiva `visible` quando il nodo entra (o sta per entrare) nel viewport — per fetch below-the-fold. */
export function useDeferredVisible(rootMargin = "240px") {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible, rootMargin]);

  return { ref, visible };
}
