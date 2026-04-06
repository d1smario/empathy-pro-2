import type { Metadata } from "next";
import TrainingBuilderRichPageView from "@/modules/training/views/TrainingBuilderRichPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Builder",
  description: "Builder sessione — vista densa Pro 2 (dati calendario + import graduale motore V1).",
};

export default function TrainingBuilderPage() {
  return <TrainingBuilderRichPageView />;
}
