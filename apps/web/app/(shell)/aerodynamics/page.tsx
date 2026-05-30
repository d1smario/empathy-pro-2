import type { Metadata } from "next";
import { Suspense } from "react";
import AerodynamicsPageView from "@/modules/aerodynamics/views/AerodynamicsPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aerodynamics",
  description: "Capture foto e video per pipeline aerodinamica Pro 2 con CdA deterministico.",
};

export default function AerodynamicsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-gray-400">Caricamento Aerodynamics...</div>
      }
    >
      <AerodynamicsPageView />
    </Suspense>
  );
}
