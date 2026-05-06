import type { Metadata } from "next";
import HealthStagingReviewView from "@/modules/health/views/HealthStagingReviewView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review referto · Health",
  description: "Revisione assistita dei valori estratti dal referto prima di entrare nell'archivio.",
};

export default function HealthStagingReviewPage({ params }: { params: { id: string } }) {
  return <HealthStagingReviewView runId={params.id} />;
}
