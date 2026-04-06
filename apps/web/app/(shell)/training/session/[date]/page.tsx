import type { Metadata } from "next";
import TrainingSessionPageView from "@/modules/training/views/TrainingSessionPageView";

export const dynamic = "force-dynamic";

type PageProps = { params: { date: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  const d = params.date ?? "";
  return {
    title: d ? `Training · ${d}` : "Training · Giornata",
    description: "Pianificato ed eseguito per la giornata selezionata.",
  };
}

export default function TrainingSessionPage() {
  return <TrainingSessionPageView />;
}
