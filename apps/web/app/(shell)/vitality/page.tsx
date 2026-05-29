import type { Metadata } from "next";
import VitalityPageView from "@/modules/vitality/views/VitalityPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vitality",
  description: "Health Index (EPI) + check-in giornaliero + Empathy Coin — motore deterministico.",
};

export default function VitalityPage() {
  return <VitalityPageView />;
}
