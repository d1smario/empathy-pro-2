import type { Metadata } from "next";
import NutritionPageView from "@/modules/nutrition/views/NutritionPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition · Integrazione",
  description: "Pathway, USDA e stack integrativo.",
};

export default function NutritionIntegrationPage() {
  return <NutritionPageView subRoute="integration" />;
}
