"use client";

import { Menu } from "lucide-react";

type MobileTopBarProps = {
  title?: string;
  onOpenDrawer: () => void;
};

export function MobileTopBar({ title = "Empathy", onOpenDrawer }: MobileTopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
        <div className="min-w-0">
          <p className="truncate bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-sm font-black tracking-tight text-transparent">
            {title}
          </p>
          <p className="font-mono text-[0.55rem] uppercase tracking-[0.2em] text-gray-500">Pro 2 · App</p>
        </div>
        <button
          type="button"
          onClick={onOpenDrawer}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-200 transition hover:border-purple-500/40 hover:bg-white/10"
          aria-label="Apri menu moduli"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
