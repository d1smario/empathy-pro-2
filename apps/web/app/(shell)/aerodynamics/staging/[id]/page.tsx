import type { Metadata } from "next";
import AerodynamicsStagingReviewView from "@/modules/aerodynamics/views/AerodynamicsStagingReviewView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review aero · Aerodynamics",
  description: "Validazione proposta geometry prima del test session canonico.",
};

export default function AerodynamicsStagingPage({ params }: { params: { id: string } }) {
  return <AerodynamicsStagingReviewView runId={params.id} />;
}
