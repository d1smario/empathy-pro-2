import type { Metadata } from "next";
import { Suspense } from "react";
import TrainingCalendarPageView from "@/modules/training/views/TrainingCalendarPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Calendar",
  description: "Planned and executed — operational window aligned with the builder.",
};

export default function TrainingCalendarPage() {
  return (
    <Suspense fallback={<div className="min-h-[40vh] animate-pulse rounded-2xl bg-white/5" />}>
      <TrainingCalendarPageView />
    </Suspense>
  );
}
