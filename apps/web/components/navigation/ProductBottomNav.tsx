"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Utensils,
  Wind,
} from "lucide-react";
import { MOBILE_BOTTOM_NAV } from "@/core/navigation/mobile-module-registry";
import type { ProductNavIconKey } from "@/core/navigation/module-registry";

const ICONS: Record<ProductNavIconKey, LucideIcon> = {
  chart: LayoutDashboard,
  users: User,
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

type ProductBottomNavProps = {
  onOpenModuleMenu?: () => void;
  moduleMenuOpen?: boolean;
};

function isNavActive(pathname: string, key: string, href: string): boolean {
  const n = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  if (key === "modules") return false;
  if (key === "training") return n.startsWith("/m/training");
  if (key === "nutrition") return n.startsWith("/m/nutrition");
  return n === href || n.startsWith(`${href}/`);
}

function isExtendedModuleActive(pathname: string): boolean {
  const n = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return (
    n.startsWith("/m/health") ||
    n.startsWith("/m/physiology") ||
    n.startsWith("/m/bioenergetics") ||
    n.startsWith("/m/biomechanics") ||
    n.startsWith("/m/aerodynamics") ||
    n.startsWith("/m/longevity") ||
    n.startsWith("/m/settings")
  );
}

export function ProductBottomNav({ onOpenModuleMenu, moduleMenuOpen }: ProductBottomNavProps) {
  const pathname = usePathname() ?? "/m/dashboard";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl"
      aria-label="Navigazione app mobile"
    >
      <div className="mx-auto flex w-full max-w-2xl items-stretch justify-around px-0.5 pt-1">
        {MOBILE_BOTTOM_NAV.map((item) => {
          const active =
            item.action === "open-menu"
              ? moduleMenuOpen || isExtendedModuleActive(pathname)
              : isNavActive(pathname, item.key, item.href);
          const Icon = item.action === "open-menu" ? Grid3X3 : ICONS[item.icon];

          if (item.action === "open-menu") {
            return (
              <button
                key={item.key}
                type="button"
                onClick={onOpenModuleMenu}
                aria-expanded={moduleMenuOpen}
                aria-label="Apri menu moduli"
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1.5 py-2 text-[0.6rem] font-semibold transition ${
                  active ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                    active
                      ? "border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-600/30 to-orange-500/20 text-white shadow-lg shadow-fuchsia-900/20"
                      : "border-white/10 bg-white/5 text-gray-400"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden strokeWidth={2} />
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1.5 py-2 text-[0.6rem] font-semibold transition ${
                active ? "text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                  active
                    ? "border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-600/30 to-orange-500/20 text-white shadow-lg shadow-fuchsia-900/20"
                    : "border-white/10 bg-white/5 text-gray-400"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden strokeWidth={2} />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
