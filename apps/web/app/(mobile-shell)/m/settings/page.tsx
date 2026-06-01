import type { Metadata } from "next";
import MobileSettingsPageView from "@/modules/mobile/views/MobileSettingsPageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Impostazioni",
  description: "Preferenze app mobile Empathy Pro 2.",
};

export default function MobileSettingsPage() {
  return <MobileSettingsPageView />;
}
