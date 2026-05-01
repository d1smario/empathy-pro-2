import type { Metadata } from "next";
import BioenergeticTransparencyHubPageView from "@/modules/physiology/views/BioenergeticTransparencyHubPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bioenergetis",
  description: "Read-only operational transparency: twin, VIRYA inputs, nutrition dials, builder context.",
};

export default function PhysiologyBioenergeticsPage() {
  return <BioenergeticTransparencyHubPageView />;
}
