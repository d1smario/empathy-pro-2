import type { Metadata } from "next";
import TrainingHubPageView from "@/modules/training/views/TrainingHubPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Hub",
  description: "Training hub — Builder, Calendar, Analyzer, Virya.",
};

export default function TrainingHubPage() {
  return <TrainingHubPageView />;
}
