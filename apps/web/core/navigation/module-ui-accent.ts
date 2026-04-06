import type { ProductModuleId } from "@empathy/contracts";

/** Colore eyebrow `font-mono` allineato al canone `docs/PRO2_UI_PAGE_CANON.md`. */
export function moduleEyebrowClass(module: ProductModuleId): string {
  switch (module) {
    case "dashboard":
      return "text-cyan-400";
    case "athletes":
      return "text-violet-400";
    case "profile":
      return "text-fuchsia-400";
    case "health":
      return "text-rose-400";
    case "physiology":
      return "text-emerald-400";
    case "training":
      return "text-orange-400";
    case "nutrition":
      return "text-amber-400";
    case "biomechanics":
      return "text-teal-400";
    case "aerodynamics":
      return "text-sky-400";
    case "settings":
      return "text-zinc-400";
  }
}
