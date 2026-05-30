import type { Metadata } from "next";
import { Suspense } from "react";
import BiomechanicsPageView from "@/modules/biomechanics/views/BiomechanicsPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Biomechanics",
  description: "Capture video e foto per pipeline biomeccanica Pro 2 con staging e twin biomeccanico.",
};

export default function BiomechanicsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-gray-400">Caricamento Biomechanics...</div>
      }
    >
      <BiomechanicsPageView />
    </Suspense>
  );
}
