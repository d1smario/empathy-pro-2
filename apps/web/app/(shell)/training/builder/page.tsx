import type { Metadata } from "next";
import { Suspense } from "react";
import TrainingBuilderRichPageView from "@/modules/training/views/TrainingBuilderRichPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Builder",
  description: "Builder sessione — vista densa Pro 2 (dati calendario + import graduale motore V1).",
};

function BuilderRouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 text-sm text-gray-400">
      Caricamento builder…
    </div>
  );
}

export default function TrainingBuilderPage() {
  return (
    <Suspense fallback={<BuilderRouteFallback />}>
      <TrainingBuilderRichPageView />
    </Suspense>
  );
}
