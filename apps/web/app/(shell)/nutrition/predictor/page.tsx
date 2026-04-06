import type { Metadata } from "next";
import NutritionPageView from "@/modules/nutrition/views/NutritionPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition · Predictor",
  description: "Consumo energetico e glicogeno.",
};

export default function NutritionPredictorPage() {
  return <NutritionPageView subRoute="predictor" />;
}
