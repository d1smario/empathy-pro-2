import type { Metadata } from "next";
import PhysiologyPageView from "@/modules/physiology/views/PhysiologyPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Physiology",
};

export default function MobilePhysiologyPage() {
  return <PhysiologyPageView />;
}
