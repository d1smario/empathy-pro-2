import type { Metadata } from "next";
import ProfilePageView from "@/modules/profile/views/ProfilePageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Identità atleta, fisiologia e vincoli nutrizionali.",
};

export default function ProfilePage() {
  return <ProfilePageView />;
}
