"use client";

import { BarChart3, CalendarDays, CalendarRange, LayoutDashboard, LayoutGrid, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  MODULE_PILL_AMBER,
  MODULE_PILL_CYAN,
  MODULE_PILL_EMERALD,
  MODULE_PILL_FUCHSIA,
  MODULE_PILL_ROSE,
  MODULE_PILL_SKY,
} from "@/components/navigation/module-pill-styles";
import { ModulePillSubnav, type ModulePillLinkItem, routeActive } from "@/components/navigation/ModulePillSubnav";

const ITEMS: ModulePillLinkItem[] = [
  {
    key: "hub",
    href: "/training",
    label: "Hub",
    icon: LayoutGrid,
    style: MODULE_PILL_CYAN,
  },
  {
    key: "builder",
    href: "/training/builder",
    label: "Builder",
    icon: Sparkles,
    style: MODULE_PILL_FUCHSIA,
  },
  {
    key: "calendar",
    href: "/training/calendar",
    label: "Calendar",
    icon: CalendarDays,
    style: MODULE_PILL_SKY,
  },
  {
    key: "virya",
    href: "/training/vyria",
    label: "Virya",
    icon: CalendarRange,
    style: MODULE_PILL_AMBER,
  },
  {
    key: "analyzer",
    href: "/training/analytics",
    label: "Analyzer",
    icon: BarChart3,
    style: MODULE_PILL_ROSE,
  },
  {
    key: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    style: MODULE_PILL_EMERALD,
  },
];

/**
 * Nav secondaria training: Hub, Builder, Calendar, Virya, Analyzer, Dashboard.
 */
export function TrainingSubnav() {
  const pathname = usePathname();

  return (
    <ModulePillSubnav
      variant="link"
      items={ITEMS}
      isActive={(item) => routeActive(pathname, item.href)}
      ariaLabel="Sotto-moduli training"
    />
  );
}
