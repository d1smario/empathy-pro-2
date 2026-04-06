import type { Metadata } from "next";
import NutritionPageView from "@/modules/nutrition/views/NutritionPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition · Fueling",
  description: "Pre, intra e post workout.",
};

export default function NutritionFuelingPage() {
  return <NutritionPageView subRoute="fueling" />;
}
