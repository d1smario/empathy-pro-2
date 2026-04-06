import type { Metadata } from "next";
import NutritionPageView from "@/modules/nutrition/views/NutritionPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition · Diario",
  description: "Diario alimentare e aderenza.",
};

export default function NutritionDiaryPage() {
  return <NutritionPageView subRoute="diary" />;
}
