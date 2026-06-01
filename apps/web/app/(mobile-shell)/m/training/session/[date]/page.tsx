import type { Metadata } from "next";
import TrainingSessionPageView from "@/modules/training/views/TrainingSessionPageView";

export const dynamic = "force-dynamic";

type PageProps = { params: { date: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  const d = params.date ?? "";
  return {
    title: d ? `Training · ${d}` : "Training · Giornata",
    description: "Pianificato ed eseguito — app mobile.",
  };
}

export default function MobileTrainingSessionPage() {
  return (
    <div className="mx-auto max-w-lg px-2 pb-4 pt-2">
      <TrainingSessionPageView />
    </div>
  );
}
