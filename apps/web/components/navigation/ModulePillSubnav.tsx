"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import type { ModulePillStyle } from "@/components/navigation/module-pill-styles";

const NAV_SHELL =
  "flex flex-wrap gap-2 rounded-2xl border border-orange-500/20 bg-gradient-to-r from-orange-500/[0.07] via-fuchsia-500/[0.06] to-violet-500/[0.08] p-2 shadow-inner";

const BTN_BASE =
  "inline-flex min-w-[6.5rem] flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition sm:min-w-0 sm:flex-none sm:px-4";

export type ModulePillLinkItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  style: ModulePillStyle;
};

export type ModulePillAnchorItem = {
  key: string;
  anchor: string;
  label: string;
  icon: LucideIcon;
  style: ModulePillStyle;
};

export function routeActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  const p = pathname.replace(/\/$/, "") || "/";
  const h = href.replace(/\/$/, "") || "/";
  if (h === "/training") return p === "/training";
  if (h === "/training/calendar") return p === "/training/calendar" || p.startsWith("/training/session/");
  if (h === "/training/vyria")
    return p === "/training/vyria" || p.startsWith("/training/vyria/") || p === "/training/virya" || p.startsWith("/training/virya/");
  if (h === "/training/analytics")
    return p === "/training/analytics" || p.startsWith("/training/analytics/") || p === "/training/analyzer" || p.startsWith("/training/analyzer/");
  if (h === "/dashboard") return p === "/dashboard" || p.startsWith("/dashboard/");
  return p === h || p.startsWith(`${h}/`);
}

type LinkVariant = {
  variant: "link";
  items: ModulePillLinkItem[];
  isActive: (item: ModulePillLinkItem) => boolean;
  ariaLabel: string;
};

type AnchorVariant = {
  variant: "anchor";
  items: ModulePillAnchorItem[];
  activeAnchor: string;
  onSelect: (anchor: string) => void;
  ariaLabel: string;
};

export type ModulePillSubnavProps = LinkVariant | AnchorVariant;

export function ModulePillSubnav(props: ModulePillSubnavProps) {
  if (props.variant === "link") {
    return (
      <nav className={NAV_SHELL} aria-label={props.ariaLabel}>
        {props.items.map((item) => {
          const I = item.icon;
          const active = props.isActive(item);
          const s = item.style;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`${BTN_BASE} ${
                active
                  ? `${s.activeGradient} ${s.activeRing} border border-white/20 text-white`
                  : `${s.idleBorder} ${s.idleBg} border text-gray-400 hover:border-white/25 hover:bg-white/5 hover:text-gray-100`
              }`}
            >
              <I className={`h-4 w-4 shrink-0 ${active ? s.iconActive : s.iconIdle}`} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className={NAV_SHELL} aria-label={props.ariaLabel}>
      {props.items.map((item) => {
        const I = item.icon;
        const active = props.activeAnchor === item.anchor;
        const s = item.style;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => props.onSelect(item.anchor)}
            className={`${BTN_BASE} ${
              active
                ? `${s.activeGradient} ${s.activeRing} border border-white/20 text-white`
                : `${s.idleBorder} ${s.idleBg} border text-gray-400 hover:border-white/25 hover:bg-white/5 hover:text-gray-100`
            }`}
          >
            <I className={`h-4 w-4 shrink-0 ${active ? s.iconActive : s.iconIdle}`} aria-hidden />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

export function scrollToModuleAnchor(anchorId: string) {
  if (typeof document === "undefined") return;
  document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
