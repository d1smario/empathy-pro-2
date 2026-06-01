import type { Metadata } from "next";
import BiomechanicsSessionReportView from "@/modules/biomechanics/views/BiomechanicsSessionReportView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report biomeccanico · Biomechanics",
  description: "Report sessione con angoli, simmetria, rischio ed export PDF.",
};

export default function BiomechanicsSessionReportPage({ params }: { params: { id: string } }) {
  return <BiomechanicsSessionReportView sessionId={params.id} />;
}
