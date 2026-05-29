import type { Metadata } from "next";
import LongevityFitnessPageView from "@/modules/longevity/views/LongevityFitnessPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Longevity & Fitness",
  description: "Longevity & Fitness Index (EPI) + check-in giornaliero + Empathy Coin — motore deterministico.",
};

export default function LongevityFitnessPage() {
  return <LongevityFitnessPageView />;
}
