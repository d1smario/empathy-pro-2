import type { Metadata } from "next";
import BiomechanicsPageView from "@/modules/biomechanics/views/BiomechanicsPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Biomechanics",
};

export default function MobileBiomechanicsPage() {
  return <BiomechanicsPageView />;
}
