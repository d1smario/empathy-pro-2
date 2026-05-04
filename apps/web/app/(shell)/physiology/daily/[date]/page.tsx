import type { Metadata } from "next";
import PhysiologyDailyWellnessPageView from "@/modules/physiology/views/PhysiologyDailyWellnessPageView";

export const dynamic = "force-dynamic";

type PageProps = { params: { date: string } };

export function generateMetadata({ params }: PageProps): Metadata {
  const d = params.date ?? "";
  return {
    title: d ? `Physiology · Giornata ${d}` : "Physiology · Giornata",
    description: "Pannello giornaliero: recovery, sonno, attività e biomarker allineati al calendario.",
  };
}

export default function PhysiologyDailyPage() {
  return <PhysiologyDailyWellnessPageView />;
}
