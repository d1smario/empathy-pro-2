import type { Metadata } from "next";
import TrainingAnalyticsPageView from "@/modules/training/views/TrainingAnalyticsPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Analyzer",
  description: "KPI and trends — Pro 2 roadmap, same builder contracts. Alias /training/analyzer.",
};

export default function TrainingAnalyticsPage() {
  return <TrainingAnalyticsPageView />;
}
