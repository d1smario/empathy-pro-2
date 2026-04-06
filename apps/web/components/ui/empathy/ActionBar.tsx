import { cn } from "@/lib/cn";

type ActionBarProps = {
  children: React.ReactNode;
  className?: string;
  /** Visually dominant row of actions; keep few items (Pro 2 density). */
  "aria-label"?: string;
};

/**
 * Single horizontal band for primary actions (buttons). Prefer 1–3 controls.
 * See `.cursor/rules/empathy_pro2_ui_language.mdc`.
 */
export function ActionBar({ children, className, "aria-label": ariaLabel = "Azioni" }: ActionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-3", className)}
    >
      {children}
    </div>
  );
}
