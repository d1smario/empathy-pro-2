import type { Metadata } from "next";
import LongevityFitnessPageView from "@/modules/longevity/views/LongevityFitnessPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Longevity & Fitness",
};

export default function MobileLongevityPage() {
  return <LongevityFitnessPageView />;
}
