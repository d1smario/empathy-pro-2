import type { Metadata } from "next";
import ProfilePageView from "@/modules/profile/views/ProfilePageView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
  description: "Profilo atleta — app mobile.",
};

export default function MobileProfilePage() {
  return (
    <div className="mx-auto max-w-lg px-2 pb-4 pt-2">
      <ProfilePageView />
    </div>
  );
}
