import type { Metadata } from "next";
import MobileTodayPageView from "@/modules/mobile/views/MobileTodayPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Oggi",
  description: "Hub operativo giornaliero atleta.",
};

export default function MobileDashboardPage() {
  return <MobileTodayPageView />;
}
