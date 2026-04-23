import type { Metadata } from "next";
import AdminConsoleView from "@/modules/admin/views/AdminConsoleView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Amministrazione",
  description: "Console piattaforma Empathy Pro 2 — abilitazione coach e gestione.",
};

export default function AdminPage() {
  return <AdminConsoleView />;
}
