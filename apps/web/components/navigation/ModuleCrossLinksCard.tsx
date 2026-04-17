import type { ProductModuleId } from "@empathy/contracts";
import { Link2 } from "lucide-react";
import { Pro2SectionCard } from "@/components/shell/Pro2SectionCard";
import { Pro2Link } from "@/components/ui/empathy";

const GENERATIVE_CROSS: Partial<Record<ProductModuleId, { href: string; label: string; className?: string }[]>> = {
  profile: [
    { href: "/training/builder", label: "Builder", className: "border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15" },
    { href: "/nutrition", label: "Nutrition", className: "border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15" },
    { href: "/physiology", label: "Physiology", className: "border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15" },
    { href: "/health", label: "Health", className: "border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/15" },
  ],
  training: [
    { href: "/physiology/bioenergetics", label: "Hub bioenergetico", className: "border-emerald-500/40 bg-emerald-500/12 hover:bg-emerald-500/18" },
    { href: "/nutrition", label: "Nutrition", className: "border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15" },
    { href: "/physiology", label: "Physiology", className: "border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15" },
    { href: "/dashboard", label: "Dashboard", className: "border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15" },
  ],
  nutrition: [
    { href: "/physiology/bioenergetics", label: "Hub bioenergetico", className: "border-emerald-500/40 bg-emerald-500/12 hover:bg-emerald-500/18" },
    { href: "/training", label: "Training", className: "border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15" },
    { href: "/physiology", label: "Physiology", className: "border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15" },
    { href: "/health", label: "Health", className: "border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/15" },
    { href: "/dashboard", label: "Dashboard", className: "border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15" },
  ],
  physiology: [
    { href: "/physiology/bioenergetics", label: "Hub bioenergetico", className: "border-emerald-500/40 bg-emerald-500/12 hover:bg-emerald-500/18" },
    { href: "/training/builder", label: "Builder", className: "border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15" },
    { href: "/nutrition", label: "Nutrition", className: "border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15" },
    { href: "/health", label: "Health", className: "border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/15" },
    { href: "/profile", label: "Profile", className: "border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/15" },
  ],
  health: [
    { href: "/nutrition", label: "Nutrition", className: "border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15" },
    { href: "/physiology", label: "Physiology", className: "border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15" },
    { href: "/training/calendar", label: "Calendar", className: "border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15" },
    { href: "/profile", label: "Profile", className: "border-fuchsia-500/30 bg-fuchsia-500/10 hover:bg-fuchsia-500/15" },
  ],
  biomechanics: [
    { href: "/training", label: "Training", className: "border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15" },
    { href: "/physiology", label: "Physiology", className: "border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15" },
    { href: "/dashboard", label: "Dashboard", className: "border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15" },
  ],
  aerodynamics: [
    { href: "/training", label: "Training", className: "border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15" },
    { href: "/physiology", label: "Physiology", className: "border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15" },
    { href: "/dashboard", label: "Dashboard", className: "border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15" },
  ],
};

/** Link incrociati tra moduli generativi (stesso canone Pro2SectionCard). */
export function ModuleCrossLinksCard({ module }: { module: ProductModuleId }) {
  const items = GENERATIVE_CROSS[module];
  if (!items?.length) return null;
  return (
    <Pro2SectionCard accent="cyan" title="Moduli collegati" subtitle="Stesso atleta, contratti condivisi" icon={Link2}>
      <div className="flex flex-wrap gap-2">
        {items.map((x) => (
          <Pro2Link
            key={x.href}
            href={x.href}
            variant="secondary"
            className={`justify-center ${x.className ?? "border-white/20 bg-white/5 hover:bg-white/10"}`}
          >
            {x.label}
          </Pro2Link>
        ))}
      </div>
    </Pro2SectionCard>
  );
}
