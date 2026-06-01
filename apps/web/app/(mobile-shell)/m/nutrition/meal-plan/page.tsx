import type { Metadata } from "next";
import { Suspense } from "react";
import NutritionPageView from "@/modules/nutrition/views/NutritionPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition · Meal plan",
  description: "Meal plan atleta — app mobile.",
};

export default function MobileNutritionMealPlanPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" />}>
      <div className="mx-auto max-w-lg px-1 pb-4 pt-1">
        <NutritionPageView subRoute="meal-plan" />
      </div>
    </Suspense>
  );
}
