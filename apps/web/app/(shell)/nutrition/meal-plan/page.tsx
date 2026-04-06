import type { Metadata } from "next";
import NutritionPageView from "@/modules/nutrition/views/NutritionPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition · Meal plan",
  description: "Piano pasti e target giornalieri.",
};

export default function NutritionMealPlanPage() {
  return <NutritionPageView subRoute="meal-plan" />;
}
