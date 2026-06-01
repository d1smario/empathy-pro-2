"use client";

import Link from "next/link";
import {
  Activity,
  Award,
  Calendar,
  Cpu,
  Grid3X3,
  Heart,
  LayoutDashboard,
  type LucideIcon,
  Move,
  Settings,
  User,
  Users,
  Utensils,
  Wind,
  X,
} from "lucide-react";
import {
  EMPATHY_DESKTOP_COOKIE,
  MOBILE_MODULE_MENU_SECTIONS,
  type MobileMenuItem,
} from "@/core/navigation/mobile-module-registry";
import type { ProductNavIconKey } from "@/core/navigation/module-registry";
import { Pro2Button } from "@/components/ui/empathy";

type MobileModuleDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const ICONS: Record<ProductNavIconKey, LucideIcon> = {
  chart: LayoutDashboard,
  users: Users,
  user: User,
  heart: Heart,
  activity: Activity,
  calendar: Calendar,
  utensils: Utensils,
  pulse: Cpu,
  motion: Move,
  wind: Wind,
  award: Award,
  settings: Settings,
};

function setDesktopPreferenceCookie() {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${EMPATHY_DESKTOP_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function ModuleTile({
  item,
  onClose,
}: {
  item: MobileMenuItem;
  onClose: () => void;
}) {
  const Icon = ICONS[item.icon];

  if (item.desktopOnly && item.key === "desktop") {
    return (
      <Pro2Button
        type="button"
        variant="secondary"
        className="flex h-full min-h-[5.25rem] w-full flex-col items-start justify-between gap-2 rounded-2xl border-white/15 bg-white/5 p-3 text-left"
        onClick={() => {
          setDesktopPreferenceCookie();
          window.location.href = "/dashboard";
        }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300">
          <Icon className="h-4 w-4" aria-hidden strokeWidth={2} />
        </span>
        <span className="text-xs font-semibold leading-tight text-gray-200">{item.label}</span>
      </Pro2Button>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className="group flex min-h-[5.25rem] flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-fuchsia-500/35 hover:bg-white/10"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-600/25 to-orange-500/15 text-white transition group-hover:border-fuchsia-500/40">
        <Icon className="h-4 w-4" aria-hidden strokeWidth={2} />
      </span>
      <span className="text-xs font-semibold leading-tight text-gray-200">{item.label}</span>
      {item.desktopOnly ? (
        <span className="font-mono text-[0.55rem] uppercase tracking-wide text-gray-500">Desktop</span>
      ) : null}
    </Link>
  );
}

export function MobileModuleDrawer({ open, onClose }: MobileModuleDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Menu moduli">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Chiudi menu"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[min(92vh,40rem)] flex-col rounded-t-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-purple-950/50">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-base font-bold text-white">Moduli Empathy</p>
            <p className="text-[0.65rem] text-gray-500">Hub operativo, salute, lab e impostazioni</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-300"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2">
          {MOBILE_MODULE_MENU_SECTIONS.map((section) => (
            <section key={section.key} className="mb-5 last:mb-2">
              <p className="mb-2 px-1 font-mono text-[0.6rem] uppercase tracking-[0.25em] text-gray-500">
                {section.title}
              </p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {section.items.map((item) => (
                  <li key={item.key}>
                    <ModuleTile item={item} onClose={onClose} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 py-3">
          <p className="flex items-center gap-2 text-[0.65rem] text-gray-500">
            <Grid3X3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Builder, VIRYA e staging lab avanzato restano su versione desktop.
          </p>
        </div>
      </div>
    </div>
  );
}
