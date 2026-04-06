import type { Metadata } from "next";
import TrainingViryaPageView from "@/modules/training/views/TrainingViryaPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Training · Virya",
  description: "Annual plan — orchestration toward builder materialization. Alias /training/virya.",
};

export default function TrainingVyriaPage() {
  return <TrainingViryaPageView />;
}
