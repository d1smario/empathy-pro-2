import type { Metadata } from "next";
import nextDynamic from "next/dynamic";

const NutritionPageView = nextDynamic(() => import("@/modules/nutrition/views/NutritionPageView"), {
  loading: () => <div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" aria-hidden />,
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition · Predictor",
  description: "Consumo energetico e glicogeno.",
};

export default function NutritionPredictorPage() {
  return <NutritionPageView subRoute="predictor" />;
}
