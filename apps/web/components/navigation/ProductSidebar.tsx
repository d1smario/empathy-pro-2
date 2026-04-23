"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Calendar,
  Heart,
  LayoutDashboard,
  type LucideIcon,
  Move,
  Settings,
  Shield,
  User,
  Users,
  Utensils,
  Wind,
} from "lucide-react";
import { PRODUCT_MODULE_NAV, type ProductModuleNavItem, type ProductNavIconKey } from "@/core/navigation/module-registry";
import { SidebarSessionActions } from "@/components/navigation/SidebarSessionActions";

const ICONS: Record<ProductNavIconKey, LucideIcon> = {
  chart: LayoutDashboard,
  users: Users,
  user: User,
  heart: Heart,
  activity: Activity,
  calendar: Calendar,
  utensils: Utensils,
  motion: Move,
  wind: Wind,
  settings: Settings,
};

function NavLink({ item }: { item: ProductModuleNavItem }) {
  const pathname = usePathname();
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isActive =
    normalized === item.href || (item.href !== "/" && normalized.startsWith(`${item.href}/`));
  const Icon = ICONS[item.icon];

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        isActive
          ? "border border-transparent bg-gradient-to-r from-purple-600 to-orange-500 text-white shadow-lg shadow-purple-500/30"
          : "border border-white/10 bg-white/5 text-gray-300 backdrop-blur-sm hover:border-purple-500/40"
      }`}
    >
      {isActive ? (
        <span
          className="absolute inset-y-0 left-0 w-1 rounded-full bg-gradient-to-b from-orange-400 via-pink-400 to-purple-400"
          aria-hidden
        />
      ) : null}
      <span
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
          isActive
            ? "border-white/20 bg-black/20 text-white"
            : "border-white/10 bg-black/20 text-gray-400 group-hover:text-purple-300"
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden strokeWidth={2} />
      </span>
      <span className="relative truncate">{item.label}</span>
    </Link>
  );
}

function AdminConsoleSidebarLink() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let c = false;
    void fetch("/api/admin/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ isAdmin?: boolean }>)
      .then((j) => {
        if (!c) setVisible(j.isAdmin === true);
      })
      .catch(() => {
        if (!c) setVisible(false);
      });
    return () => {
      c = true;
    };
  }, []);
  if (!visible) return null;
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const isActive = normalized === "/admin" || normalized.startsWith("/admin/");
  return (
    <Link
      href="/admin"
      aria-current={isActive ? "page" : undefined}
      className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
        isActive
          ? "border border-transparent bg-gradient-to-r from-orange-600 to-rose-600 text-white shadow-lg shadow-orange-500/25"
          : "border border-white/10 bg-white/5 text-gray-300 backdrop-blur-sm hover:border-orange-500/40"
      }`}
    >
      {isActive ? (
        <span
          className="absolute inset-y-0 left-0 w-1 rounded-full bg-gradient-to-b from-orange-300 via-rose-400 to-amber-400"
          aria-hidden
        />
      ) : null}
      <span
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
          isActive
            ? "border-white/20 bg-black/20 text-white"
            : "border-white/10 bg-black/20 text-gray-400 group-hover:text-orange-200"
        }`}
      >
        <Shield className="h-4 w-4" aria-hidden strokeWidth={2} />
      </span>
      <span className="relative truncate">Admin · Piattaforma</span>
    </Link>
  );
}

export function ProductSidebar() {
  const main = PRODUCT_MODULE_NAV.filter((i) => i.area === "main");
  const footer = PRODUCT_MODULE_NAV.filter((i) => i.area === "footer");

  return (
    <aside className="relative flex w-[16.5rem] shrink-0 flex-col border-r border-white/10 bg-black/40 shadow-[inset_-1px_0_0_rgba(168,85,247,0.12)] backdrop-blur-xl">
      <div className="relative border-b border-white/10 px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-gradient-to-br from-orange-400 to-pink-500" />
          </span>
          <Link href="/" className="text-lg font-black tracking-[0.1em] text-white sm:text-xl">
            EMPATHY
          </Link>
        </div>
        <p className="mt-1 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg">
          Pro 2.0
        </p>
        <p className="mt-1 font-mono text-[0.65rem] text-gray-500">SYS · NAV</p>
      </div>
      <nav className="relative flex flex-1 flex-col gap-1.5 overflow-y-auto p-3" aria-label="Moduli prodotto">
        {main.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>
      <div className="space-y-1.5 border-t border-white/10 bg-black/30 p-3">
        {footer.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
        <AdminConsoleSidebarLink />
        <SidebarSessionActions />
        <Link
          href="/pricing"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-gray-400 transition hover:border-purple-500/35 hover:text-purple-200"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500/60" aria-hidden />
          Piani
        </Link>
        <Link
          href="/preview"
          className="flex items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/5 px-3 py-2 text-xs font-medium text-orange-200/90 transition hover:border-pink-500/40 hover:text-pink-200"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-pink-400 to-orange-400 shadow-[0_0_8px_#f472b6]" aria-hidden />
          Marketing demo
        </Link>
      </div>
    </aside>
  );
}
