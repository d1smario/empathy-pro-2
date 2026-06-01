"use client";

import Link from "next/link";
import { BookOpen, Utensils } from "lucide-react";
import { MobileModulePageShell } from "@/components/shell/MobileModulePageShell";
import { Pro2Link } from "@/components/ui/empathy";

export default function MobileNutritionHubView() {
  return (
    <MobileModulePageShell
      eyebrow="Nutrition"
      title="Alimentazione"
      description="Meal plan e diario — per editing avanzato usa la versione desktop."
    >
      <div className="grid gap-3">
        <Link
          href="/m/nutrition/meal-plan"
          className="flex items-center gap-3 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-4 transition hover:border-orange-400/50"
        >
          <Utensils className="h-5 w-5 shrink-0 text-orange-300" aria-hidden />
          <div>
            <p className="font-semibold text-white">Meal plan</p>
            <p className="text-xs text-gray-400">Target giornalieri e pasti</p>
          </div>
        </Link>
        <Link
          href="/m/nutrition/diary"
          className="flex items-center gap-3 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-4 transition hover:border-fuchsia-400/50"
        >
          <BookOpen className="h-5 w-5 shrink-0 text-fuchsia-300" aria-hidden />
          <div>
            <p className="font-semibold text-white">Diario</p>
            <p className="text-xs text-gray-400">Pasti registrati e aderenza</p>
          </div>
        </Link>
      </div>
      <Pro2Link href="/nutrition/meal-plan" variant="ghost" className="text-xs text-gray-500">
        Apri meal plan desktop
      </Pro2Link>
    </MobileModulePageShell>
  );
}
