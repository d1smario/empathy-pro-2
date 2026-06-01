import type { Metadata } from "next";
import MobileNutritionHubView from "@/modules/mobile/views/MobileNutritionHubView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition",
  description: "Meal plan e diario — app mobile.",
};

export default function MobileNutritionPage() {
  return <MobileNutritionHubView />;
}
