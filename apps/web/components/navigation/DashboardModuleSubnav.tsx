"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Heart } from "lucide-react";
import { MODULE_PILL_CYAN, MODULE_PILL_ROSE } from "@/components/navigation/module-pill-styles";
import { ModulePillSubnav, type ModulePillAnchorItem, scrollToModuleAnchor } from "@/components/navigation/ModulePillSubnav";

export const DASHBOARD_MODULE_ANCHORS = ["dash-intro", "dash-core"] as const;

const ITEMS: ModulePillAnchorItem[] = [
  {
    key: "intro",
    anchor: "dash-intro",
    label: "Empathy · piani",
    icon: Heart,
    style: MODULE_PILL_ROSE,
  },
  {
    key: "core",
    anchor: "dash-core",
    label: "Core",
    icon: Activity,
    style: MODULE_PILL_CYAN,
  },
];

export function DashboardModuleSubnav() {
  const [activeAnchor, setActiveAnchor] = useState<string>(DASHBOARD_MODULE_ANCHORS[0]);

  const onSelect = useCallback((anchor: string) => {
    setActiveAnchor(anchor);
    scrollToModuleAnchor(anchor);
  }, []);

  useEffect(() => {
    const elements = DASHBOARD_MODULE_ANCHORS.map((id) => document.getElementById(id)).filter(
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
      ariaLabel="Sezioni dashboard"
    />
  );
}
