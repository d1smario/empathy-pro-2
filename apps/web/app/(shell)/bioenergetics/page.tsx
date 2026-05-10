import type { Metadata } from "next";
import { Suspense } from "react";
import BioenergeticsPageView from "@/modules/bioenergetics/views/BioenergeticsPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BioEnergetic Intelligence",
  description: "Report giornaliero fisiologico: training, nutrizione, stream device e pathway metabolici.",
};

export default function BioenergeticsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-gray-400">Caricamento BioEnergetic…</div>
      }
    >
      <BioenergeticsPageView />
    </Suspense>
  );
}
