"use client";

import { Activity, BookMarked, ChefHat, Flame, Layers, Workflow } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  MODULE_PILL_AMBER,
  MODULE_PILL_CYAN,
  MODULE_PILL_EMERALD,
  MODULE_PILL_FUCHSIA,
  MODULE_PILL_ORANGE,
  MODULE_PILL_ROSE,
} from "@/components/navigation/module-pill-styles";
import { ModulePillSubnav, type ModulePillLinkItem } from "@/components/navigation/ModulePillSubnav";

export const NUTRITION_SUBNAV_PATHS = {
  mealPlan: "/nutrition/meal-plan",
  fueling: "/nutrition/fueling",
  integration: "/nutrition/integration",
  predictor: "/nutrition/predictor",
  diary: "/nutrition/diary",
} as const;

const ITEMS: ModulePillLinkItem[] = [
  {
    key: "operational-hub",
    href: "/physiology/bioenergetics",
    label: "Segnali",
    icon: Layers,
    style: MODULE_PILL_AMBER,
  },
  {
    key: "meal-plan",
    href: NUTRITION_SUBNAV_PATHS.mealPlan,
    label: "Meal plan",
    icon: ChefHat,
    style: MODULE_PILL_EMERALD,
  },
  {
    key: "fueling",
    href: NUTRITION_SUBNAV_PATHS.fueling,
    label: "Fueling",
    icon: Flame,
    style: MODULE_PILL_ORANGE,
  },
  {
    key: "integration",
    href: NUTRITION_SUBNAV_PATHS.integration,
    label: "Integrazione",
    icon: Workflow,
    style: MODULE_PILL_FUCHSIA,
  },
  {
    key: "predictor",
    href: NUTRITION_SUBNAV_PATHS.predictor,
    label: "Predictor",
    icon: Activity,
    style: MODULE_PILL_CYAN,
  },
  {
    key: "diary",
    href: NUTRITION_SUBNAV_PATHS.diary,
    label: "Diario alimentare",
    icon: BookMarked,
    style: MODULE_PILL_ROSE,
  },
];

function isMealPlanPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const p = pathname.replace(/\/$/, "") || "/";
  return p === "/nutrition/meal-plan" || p === "/nutrition";
}

/**
 * Sotto-moduli nutrition: una pagina per area (come Training builder/calendar/…).
 */
export function NutritionSubnav() {
  const pathname = usePathname();

  return (
    <ModulePillSubnav
      variant="link"
      items={ITEMS}
      isActive={(item) => {
        if (item.href === NUTRITION_SUBNAV_PATHS.mealPlan) return isMealPlanPath(pathname);
        if (!pathname) return false;
        const p = pathname.replace(/\/$/, "") || "/";
        const h = item.href.replace(/\/$/, "") || "/";
        return p === h;
      }}
      ariaLabel="Sezioni nutrition"
    />
  );
}
