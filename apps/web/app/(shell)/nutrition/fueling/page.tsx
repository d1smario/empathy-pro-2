import type { Metadata } from "next";
import nextDynamic from "next/dynamic";

const NutritionPageView = nextDynamic(() => import("@/modules/nutrition/views/NutritionPageView"), {
  loading: () => <div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" aria-hidden />,
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition · Fueling",
  description: "Pre, intra e post workout.",
};

export default function NutritionFuelingPage() {
  return <NutritionPageView subRoute="fueling" />;
}
