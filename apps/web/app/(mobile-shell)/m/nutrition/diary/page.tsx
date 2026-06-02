import type { Metadata } from "next";
import { Suspense } from "react";
import nextDynamic from "next/dynamic";

const NutritionPageView = nextDynamic(() => import("@/modules/nutrition/views/NutritionPageView"), {
  loading: () => <div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" aria-hidden />,
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nutrition · Diario",
  description: "Diario alimentare — app mobile.",
};

export default function MobileNutritionDiaryPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" />}>
      <div className="mx-auto max-w-lg px-1 pb-4 pt-1">
        <NutritionPageView subRoute="diary" />
      </div>
    </Suspense>
  );
}
