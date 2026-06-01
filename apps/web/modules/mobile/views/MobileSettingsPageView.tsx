"use client";

import { EMPATHY_DESKTOP_COOKIE } from "@/core/navigation/mobile-module-registry";
import { SettingsLocalePreference } from "@/components/settings/SettingsLocalePreference";
import { MobileModulePageShell } from "@/components/shell/MobileModulePageShell";
import { Pro2Button } from "@/components/ui/empathy";

function preferDesktopSite() {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${EMPATHY_DESKTOP_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
  window.location.href = "/dashboard";
}

export default function MobileSettingsPageView() {
  return (
    <MobileModulePageShell
      eyebrow="Impostazioni"
      title="Preferenze"
      description="App mobile Empathy Pro 2. Per builder, VIRYA e moduli lab usa la versione desktop."
    >
      <SettingsLocalePreference />
      <Pro2Button
        type="button"
        variant="secondary"
        className="w-full border-white/15 bg-white/5"
        onClick={preferDesktopSite}
      >
        Usa versione desktop
      </Pro2Button>
    </MobileModulePageShell>
  );
}
