import type { Metadata } from "next";
import BioenergeticsPageView from "@/modules/bioenergetics/views/BioenergeticsPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BioEnergetic Intelligence",
  description: "Report giornaliero fisiologico: training, nutrizione, stream device e pathway metabolici.",
};

export default function BioenergeticsPage() {
  return <BioenergeticsPageView />;
}
