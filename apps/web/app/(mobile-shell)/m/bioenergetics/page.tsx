import type { Metadata } from "next";
import BioenergeticsPageView from "@/modules/bioenergetics/views/BioenergeticsPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BioEnergetic Intelligence",
};

export default function MobileBioenergeticsPage() {
  return <BioenergeticsPageView />;
}
