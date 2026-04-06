"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, LayoutGrid, Link2 } from "lucide-react";
import {
  MODULE_PILL_CYAN,
  MODULE_PILL_FUCHSIA,
  MODULE_PILL_SKY,
} from "@/components/navigation/module-pill-styles";
import { ModulePillSubnav, type ModulePillAnchorItem, scrollToModuleAnchor } from "@/components/navigation/ModulePillSubnav";

export const STANDARD_MODULE_ANCHORS = ["std-domain", "std-links", "std-ops"] as const;

const ITEMS: ModulePillAnchorItem[] = [
  {
    key: "domain",
    anchor: "std-domain",
    label: "Ambito",
    icon: BookOpen,
    style: MODULE_PILL_CYAN,
  },
  {
    key: "links",
    anchor: "std-links",
    label: "Collegamenti",
    icon: Link2,
    style: MODULE_PILL_FUCHSIA,
  },
  {
    key: "ops",
    anchor: "std-ops",
    label: "Operatività",
    icon: LayoutGrid,
    style: MODULE_PILL_SKY,
  },
];

export function standardModuleNavAnchors(): string[] {
  return [...STANDARD_MODULE_ANCHORS];
}

/**
 * Subnav a pill per moduli standard (dashboard, athletes, settings): scroll alle sezioni della pagina.
 */
export function StandardModuleSubnav() {
  const [activeAnchor, setActiveAnchor] = useState<string>(STANDARD_MODULE_ANCHORS[0]);

  const onSelect = useCallback((anchor: string) => {
    setActiveAnchor(anchor);
    scrollToModuleAnchor(anchor);
  }, []);

  useEffect(() => {
    const elements = STANDARD_MODULE_ANCHORS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (elements.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const pick = entries
          .filter((e) => e.isIntersecting && e.target.id)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = pick[0]?.target.id;
        if (id) setActiveAnchor(id);
      },
      { root: null, rootMargin: "-10% 0px -45% 0px", threshold: [0, 0.15, 0.35, 0.55] },
    );
    elements.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <ModulePillSubnav
      variant="anchor"
      items={ITEMS}
      activeAnchor={activeAnchor}
      onSelect={onSelect}
      ariaLabel="Sezioni modulo"
    />
  );
}
