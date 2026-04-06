import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shell pagina Pro 2 allineata a `TrainingBuilderRichPageView` / `docs/PRO2_UI_PAGE_CANON.md`.
 */
export function Pro2ModulePageShell({
  eyebrow,
  eyebrowClassName = "text-orange-400",
  title,
  description,
  headerActions,
  children,
  className,
}: {
  eyebrow: string;
  eyebrowClassName?: string;
  title: string;
  description?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  /** Extra classes on outer wrapper (es. `pb-16`). */
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-full bg-gradient-to-b from-zinc-950 via-black to-black px-4 py-8 sm:px-8 sm:py-10",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className={cn("font-mono text-[0.65rem] font-bold uppercase tracking-[0.25em]", eyebrowClassName)}>{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
            {description ? <div className="mt-2 max-w-xl text-sm text-gray-400">{description}</div> : null}
          </div>
          {headerActions ? <div className="flex shrink-0 flex-wrap gap-2">{headerActions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
